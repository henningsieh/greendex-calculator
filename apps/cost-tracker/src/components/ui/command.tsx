"use client";

import * as React from "react";
import { Command as Primitive } from "cmdk";
import { cn } from "cn";

export function Command(props: React.ComponentProps<typeof Primitive>) {
  return <Primitive data-slot="command" className={cn("flex flex-col bg-popover text-popover-foreground", props.className)} {...props} />;
}
export function CommandInput(props: React.ComponentProps<typeof Primitive.Input>) {
  return <Primitive.Input data-slot="command-input" className={cn("w-full border-b p-3 text-sm outline-none", props.className)} {...props} />;
}
export function CommandList(props: React.ComponentProps<typeof Primitive.List>) {
  return <Primitive.List data-slot="command-list" className={cn("max-h-72 overflow-y-auto", props.className)} {...props} />;
}
export function CommandItem(props: React.ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item data-slot="command-item" className={cn("cursor-pointer px-3 py-2 text-sm data-[selected=true]:bg-muted", props.className)} {...props} />;
}
