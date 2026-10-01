# Greendex Shared Language

Canonical product language shared by every application. App-specific terms live in the owning app context: [Calculator](apps/calculator/CONTEXT.md), [Cost Tracker](apps/cost-tracker/CONTEXT.md), [Documentation](apps/documentation/CONTEXT.md). Context overview: [AGENTS.md](AGENTS.md#contexts); change route: [domain](docs/agents/domain.md).

Greendex shares Organization, Project, and participation identities across applications while keeping carbon-footprint calculation and cost tracking as separate contexts. When a new term conflicts with existing language, resolve the conflict before changing code and update the owning glossary immediately.

## Language

**Organization**:
A group that manages its own Users and Projects. An Organization may also be assigned to a Project as a Partner Organization through a Project Partnership.

**User**:
A person with a Greendex login. A User may hold several roles in several Organizations and may be linked to several Project Participations.
_Avoid_: Participant (when referring only to login identity)

**Organization Membership**:
A User's membership in one Organization. A Membership may assign several distinct Organization-level roles to the User.
In Cost Tracker, Better Auth's fallback role value `member` is forbidden: never invite, assign, or seed it, including in combined roles. Use the defined `owner`, `admin`, `project-coordinator`, or `participant` role with its proper scope. Library table/field names and ordinary Membership wording are unaffected. See [ADR-0012](docs/adr/0012-ban-fallback-member-role-in-cost-tracker.md).
_Avoid_: Project Participation

**Organization Owner**:
A User with Better Auth role `owner` and full authority over one Organization, including its Users, settings, and Projects.
_Avoid_: Organization Administrator, Administrator

**Organization Admin**:
A User with Better Auth role `admin` and Organization-wide administrative authority below the Organization Owner.
_Avoid_: Project Coordinator, Owner

**Project Coordinator**:
A User with Better Auth role `project-coordinator` and one explicit assignment. The assignment sets the scope: a Project assignment scopes work to that Project's Hosting Organization; a Project Partnership assignment scopes work to that Partnership's Partner Organization. The role alone grants neither Organization-wide authority nor access to an unassigned Project. UI wording differs by scope: `Project Coordinator` for Hosting Organization scope, `Group Organizer` for Partner Organization scope.
_Avoid_: Organization Admin, Employee, Project Manager, Coordinator

**Participant Role**:
A persistent Better Auth role `participant` that grants Participant-facing capability in one Hosting Organization. It may coexist with other roles on the same Organization Membership and never identifies the Projects in which the User participates.
_Avoid_: Member, Project Participation

**Project**:
An initiative owned by one Organization in which Participants take part.

**Project Participation**:
One person's involvement in one specific Project. It identifies the Project and the Organization represented by that person; it may later be linked to a User.
_Avoid_: Organization Membership

**Participant**:
A person viewed through a Project Participation. A Participant may contribute application-specific data such as carbon-footprint inputs, journeys, or allocated travel costs.
_Avoid_: Member, User (when referring to participation in a Project)

**Participant Journey**:
One Participant's real journey to or from a Project. It belongs to that Participant's Project Participation and is shared by Calculator and Cost Tracker. The MVP permits exactly one per Project Participation. It records the personal route, trip type, and Erasmus Distance-Calculator distance used to select a funding band; it is not a cost or a Proof Document.
_Avoid_: Ticket, Travel Cost Entry, Partner Organization distance
