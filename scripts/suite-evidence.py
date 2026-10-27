#!/usr/bin/env python3
"""Run the repository test suites and keep per-attempt evidence.

Usage:
  ./scripts/suite-evidence.py run unit|integration|e2e|all [options]
  ./scripts/suite-evidence.py capture unit|integration|e2e [options]
  ./scripts/suite-evidence.py package [options]

Options:
  --dir PATH      Audit directory. Default: .audit/<branch issue or slug>.
  --issue N       Use .audit/N instead of the branch-derived directory.
  --no-capture    Run the suite without the before-suite receipt. No evidence
                  package is possible for that attempt.
  --keep-going    In `run all`, continue after a failing suite.
  --dry-run       Print the plan and exit without running anything.
  --output-root   Package destination. Default: <audit dir>/handover.

`run` deletes that suite's previous artifacts first, so a repeated invocation
overwrites the last attempt instead of failing on existing files.

The before-suite receipt binds the attempt to the current commit, tracked
working-tree contents, both production build fingerprints, and the production
listeners on ports 3000, 3002 and 4000. Start the production builds and servers
before you capture; a development server is rejected on purpose.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SUITES = ("unit", "integration", "e2e")
APPS = {"calculator": "apps/calculator", "costTracker": "apps/cost-tracker"}
EXCLUDED = {
    "dev",
    "cache",
    "types",
    "diagnostics",
    "trace",
    "traces",
    "logs",
    "temp",
    "tmp",
    "test-runs",
}
LIMITATIONS = [
    "Local evidence only. No deployment, merge, remote SHA, or pushed-commit attestation.",
    "Runtime observations are point-in-time checks, not continuous suite monitoring or proof of runtime-loaded build IDs.",
    "Socket ownership and NODE_ENV are observed; no application health or database provenance is attested.",
    "Build manifests hash regular output files. Build symlink targets are separately hashed; external dependency contents are not attested.",
    "Suite commands and log ownership are operator assertions; logs are not authenticated transcripts.",
    "Logs may contain private output. A human must review every file before transfer. No automatic SSH.",
]


def run(*args):
    return subprocess.run(
        args,
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=30,
    ).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def dump(path, data):
    with path.open("x") as stream:
        json.dump(data, stream, indent=2, sort_keys=True)
        stream.write("\n")


def strings(suites):
    return suites if isinstance(suites, tuple) else (suites,)


def source():
    entries = []
    for name in sorted(run("git", "ls-files", "-z").split(b"\0")):
        if not name:
            continue
        path = ROOT / os.fsdecode(name)
        if path.is_symlink():
            digest = sha(os.fsencode(os.readlink(path)))
            kind = "symlink"
        elif path.is_file():
            digest = file_sha(path)
            kind = str(path.stat().st_mode & 0o777)
        elif not path.exists():
            digest, kind = "missing", "missing"
        else:
            raise ValueError("Unsupported tracked source entry")
        entries.append([os.fsdecode(name), kind, digest])
    return {
        "commit": run("git", "rev-parse", "HEAD").decode().strip(),
        "gitStatus": run(
            "git", "status", "--porcelain=v1", "--untracked-files=all"
        )
        .decode()
        .splitlines(),
        "sourceFingerprint": sha(
            json.dumps(entries, ensure_ascii=True).encode()
        ),
        "fingerprintScope": "All tracked working-tree paths, contents and modes; includes dirty .gitignore. Untracked contents excluded.",
    }


def builds():
    ids, files, links = {}, [], {}
    for app, relative in APPS.items():
        base = ROOT / relative / ".next"
        build_id = base / "BUILD_ID"
        if not build_id.is_file() or build_id.is_symlink():
            raise ValueError(f"Missing production BUILD_ID for {app}")
        ids[app] = build_id.read_text().strip()
        if (
            not ids[app]
            or not (base / "server").is_dir()
            or not (base / "static").is_dir()
        ):
            raise ValueError(f"Incomplete production build for {app}")
        for path in sorted(base.rglob("*")):
            parts = path.relative_to(base).parts
            if (
                parts[0] in EXCLUDED
                or parts[0].startswith("trace")
                or path.name.endswith((".log", ".tmp"))
            ):
                continue
            if path.is_symlink():
                path.resolve(strict=True)
                links[path.relative_to(ROOT).as_posix()] = sha(
                    os.fsencode(os.readlink(path))
                )
                continue
            if path.is_file():
                name = path.relative_to(ROOT).as_posix()
                if "\n" in name or "\\" in name:
                    raise ValueError("Unsupported build manifest path")
                files.append(f"{file_sha(path)}  {name}\n")
    manifest = "".join(sorted(files))
    return {
        "buildIDs": ids,
        "buildSymlinkTargets": links,
        "buildFingerprint": sha(
            manifest.encode() + json.dumps(links, sort_keys=True).encode()
        ),
    }, manifest


def runtime():
    text = run("ss", "-H", "-ltnp").decode()
    observations = {}
    for port, app in ((3000, "calculator"), (3002, "costTracker"), (4000, "calculator")):
        rows = [
            line
            for line in text.splitlines()
            if len(line.split()) >= 5
            and line.split()[3].rsplit(":", 1)[-1] == str(port)
        ]
        pids = set()
        for line in rows:
            address = line.split()[3].rsplit(":", 1)[0]
            if address not in (
                "127.0.0.1",
                "[::1]",
                "::1",
                "*",
                "0.0.0.0",
                "[::]",
                "::",
            ):
                continue
            pids.update(re.findall(r"pid=(\d+)", line))
        if not pids:
            raise ValueError(f"No inspectable loopback listener on {port}")
        processes = []
        for pid in sorted(pids):
            proc = Path("/proc") / pid
            cwd = (proc / "cwd").resolve(strict=True)
            cmd = (
                (proc / "cmdline")
                .read_bytes()
                .replace(b"\0", b" ")
                .decode(errors="replace")
            )
            env = (proc / "environ").read_bytes().split(b"\0")
            production = b"NODE_ENV=production" in env
            expected = (ROOT / APPS[app]).resolve()
            if cwd != expected or not production or re.search(r"\bdev\b|--watch", cmd):
                raise ValueError(
                    f"Listener on {port} is not the expected production app process"
                )
            if port != 4000 and not re.search(
                r"next-server|next(?:/dist/bin/next| start)", cmd
            ):
                raise ValueError(
                    f"Listener on {port} is not identifiable as Next production"
                )
            if port == 4000 and "socket-server" not in cmd:
                raise ValueError(
                    "Listener on 4000 is not identifiable as calculator socket-server"
                )
            processes.append(
                {
                    "pid": int(pid),
                    "cwd": str(cwd.relative_to(ROOT)),
                    "nodeEnv": "production",
                    "kind": "socket-server" if port == 4000 else "Next server",
                }
            )
        observations[str(port)] = processes
    return observations


def snapshot():
    src = source()
    build, manifest = builds()
    observed = runtime()
    if src != source() or (build, manifest) != builds():
        raise ValueError("Source or build changed during capture")
    return {
        "schemaVersion": 1,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        **src,
        **build,
        "observedRuntime": observed,
    }, manifest


def artifacts(folder, suite):
    return [
        folder / f"{suite}{suffix}"
        for suffix in (".before.json", ".before.build-files.sha256", ".log", ".exit")
    ]


def capture(folder, suite):
    paths = artifacts(folder, suite)
    if any(p.exists() or p.is_symlink() for p in paths):
        raise ValueError(
            f"Existing {suite} attempt in {folder}. Run `run {suite}` to replace it, "
            "or move the files to an archive first."
        )
    folder.mkdir(parents=True, exist_ok=True)
    receipt, manifest = snapshot()
    with paths[1].open("x") as stream:
        stream.write(manifest)
    dump(paths[0], receipt)
    print(f"Captured {suite} before-suite receipt for {receipt['commit']}.")


def resolve_folder(args):
    if args.dir:
        return (ROOT / args.dir).resolve()
    if args.issue:
        slug = str(args.issue)
    else:
        branch = run("git", "rev-parse", "--abbrev-ref", "HEAD").decode().strip()
        match = re.search(r"(?<!\d)(\d{2,6})(?!\d)", branch)
        if match:
            slug = match.group(1)
        elif branch and branch != "HEAD":
            slug = re.sub(r"[^A-Za-z0-9._-]+", "-", branch).strip("-")
        else:
            slug = run("git", "rev-parse", "--short", "HEAD").decode().strip()
    return (ROOT / ".audit" / slug).resolve()


def clear(folder, suite):
    removed = []
    for path in artifacts(folder, suite):
        if path.exists() or path.is_symlink():
            path.unlink()
            removed.append(path.name)
    if removed:
        print(f"Removed previous {suite} artifacts: {', '.join(removed)}")


def rel(path):
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def run_suite(folder, suite, capture_before, dry):
    command = ["pnpm", "run", f"test:{suite}"]
    log = folder / f"{suite}.log"
    status = folder / f"{suite}.exit"
    if dry:
        steps = [f"rm -f {' '.join(rel(p) for p in artifacts(folder, suite))}"]
        if capture_before:
            steps.append("capture")
        steps.append(f"{' '.join(command)} | tee {rel(log)}")
        steps.append(f"write {rel(status)}")
        print(f"[{suite}] " + "  ->  ".join(steps))
        return 0
    folder.mkdir(parents=True, exist_ok=True)
    clear(folder, suite)
    if capture_before:
        capture(folder, suite)
    print(f"[{suite}] {' '.join(command)}", flush=True)
    with log.open("w") as stream:
        process = subprocess.Popen(
            command,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert process.stdout is not None
        for line in process.stdout:
            sys.stdout.write(line)
            stream.write(line)
        code = process.wait()
    status.write_text(f"exit={code}\n")
    if code:
        print(f"[{suite}] FAILED exit={code}. Log: {log}", file=sys.stderr)
    else:
        print(f"[{suite}] PASSED. Log: {log}")
    return code


def package(folder, output_root, issue):
    current, manifest = snapshot()
    receipts, results = {}, {}
    for suite in SUITES:
        receipt = json.loads((folder / f"{suite}.before.json").read_text())
        for key in (
            "schemaVersion",
            "commit",
            "sourceFingerprint",
            "gitStatus",
            "buildIDs",
            "buildFingerprint",
            "buildSymlinkTargets",
        ):
            if receipt[key] != current[key]:
                raise ValueError(f"{suite} {key} does not match current post-run observation")
        if (folder / f"{suite}.before.build-files.sha256").read_text() != manifest:
            raise ValueError(f"{suite} production build manifest mismatch")
        status = (folder / f"{suite}.exit").read_text()
        match = re.fullmatch(r"exit=(\d+)\n?", status)
        if not match or not 0 <= int(match[1]) <= 255:
            raise ValueError(f"Invalid exit receipt for {suite}")
        log = folder / f"{suite}.log"
        if not log.is_file() or log.is_symlink():
            raise ValueError(f"Missing regular log for {suite}")
        receipts[suite] = receipt
        results[suite] = {
            "command": f"pnpm run test:{suite}",
            "exitStatus": int(match[1]),
            "logSHA256": file_sha(log),
            "beforeReceipt": f"{suite}.before.json",
        }
    destination = output_root / current["commit"]
    destination.mkdir(parents=True, exist_ok=False)
    for suite in SUITES:
        shutil.copyfile(folder / f"{suite}.log", destination / f"{suite}.log")
        (destination / f"{suite}.exit").write_text(
            f"exit={results[suite]['exitStatus']}\n"
        )
        dump(destination / f"{suite}.before.json", receipts[suite])
        if file_sha(destination / f"{suite}.log") != results[suite]["logSHA256"]:
            raise ValueError(
                "Log changed during packaging; incomplete output must be archived"
            )
    verdict = (
        "PASS"
        if all(v["exitStatus"] == 0 for v in results.values())
        else "FAIL"
    )
    evidence = {
        "schemaVersion": 1,
        "generatedAt": current["capturedAt"],
        "issue": issue,
        "repository": ROOT.name,
        "git": {"commit": current["commit"], "status": current["gitStatus"]},
        "sourceBinding": {
            k: current[k] for k in ("sourceFingerprint", "fingerprintScope")
        },
        "localProductionBuild": {
            k: current[k]
            for k in (
                "buildIDs",
                "buildFingerprint",
                "buildSymlinkTargets",
                "observedRuntime",
            )
        },
        "suites": results,
        "result": verdict,
        "limitations": LIMITATIONS,
    }
    dump(destination / "evidence.json", evidence)
    dump(
        destination / "precommit-candidate.json",
        {
            **current,
            "captureRole": "Post-run packaging observation of an already committed HEAD; not a pre-commit or merge attestation.",
        },
    )
    (destination / "production-build-files.sha256").write_text(manifest)
    (destination / "HANDOVER.md").write_text(
        f"# Local test evidence\n\nResult: {verdict}\n\nCommit: `{current['commit']}`\n\n"
        + "\n".join(
            f"- {suite}: exit={results[suite]['exitStatus']}" for suite in SUITES
        )
        + "\n\n"
        + "\n".join(f"- {item}" for item in LIMITATIONS)
        + "\n\nDirty working-tree status is recorded, including user-owned .gitignore changes. "
        "No claim is made that main is merged or the local commits have been pushed. "
        "The operator owns production build/start and all three full-suite invocations.\n"
    )
    (destination / "SHA256SUMS").write_text(
        "".join(
            f"{file_sha(p)}  {p.name}\n"
            for p in sorted(destination.iterdir())
            if p.is_file()
        )
    )
    print(
        f"{verdict}: {destination}\n"
        "Review logs for private output before transfer. No transfer performed."
    )
    return 0 if verdict == "PASS" else 1


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    commands = parser.add_subparsers(dest="action", required=True)
    for name in ("capture", "run"):
        sub = commands.add_parser(name)
        sub.add_argument("suite", choices=SUITES + (("all",) if name == "run" else ()))
        sub.add_argument("--dir", type=Path)
        sub.add_argument("--issue")
        if name == "run":
            sub.add_argument("--no-capture", action="store_true")
            sub.add_argument("--keep-going", action="store_true")
            sub.add_argument("--dry-run", action="store_true")
    packaged = commands.add_parser("package")
    packaged.add_argument("--dir", type=Path)
    packaged.add_argument("--issue")
    packaged.add_argument("--output-root", type=Path)
    args = parser.parse_args()

    folder = resolve_folder(args)
    issue = args.issue or folder.name
    try:
        if args.action == "package":
            return package(folder, args.output_root or folder / "handover", issue)
        if args.action == "capture":
            capture(folder, args.suite)
            return 0
        print(f"Audit directory: {rel(folder)}")
        suites = SUITES if args.suite == "all" else (args.suite,)
        for suite in suites:
            code = run_suite(folder, suite, not args.no_capture, args.dry_run)
            if code and not args.keep_going:
                return code
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(
            f"Suite evidence failed: {type(error).__name__}: {error}",
            file=sys.stderr,
        )
        if args.action == "capture" or not getattr(args, "no_capture", False):
            print(
                "Hint: a before-suite receipt needs the production builds and "
                "servers on ports 3000, 3002 and 4000. Start them, or pass "
                "--no-capture to run the suite without a receipt.",
                file=sys.stderr,
            )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
