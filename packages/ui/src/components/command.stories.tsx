import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import {
  CalendarIcon,
  FileIcon,
  HomeIcon,
  MailIcon,
  SettingsIcon,
  UserIcon,
  SearchIcon,
} from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";
import { Button } from "./button";

const meta: Meta<typeof Command> = {
  title: "Components/Command",
  component: Command,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof Command>;

// ---- Basic ----
export const Default: Story = {
  render: () => (
    <Command className="w-80 rounded-xl border shadow-md">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>
            <HomeIcon />
            Home
          </CommandItem>
          <CommandItem>
            <FileIcon />
            Documents
          </CommandItem>
          <CommandItem>
            <MailIcon />
            Messages
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

// ---- With Shortcuts ----
export const WithShortcuts: Story = {
  render: () => (
    <Command className="w-80 rounded-xl border shadow-md">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem>
            <HomeIcon />
            Home
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <SettingsIcon />
            Settings
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <UserIcon />
            Profile
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

// ---- With Multiple Groups + Separator ----
export const WithGroups: Story = {
  render: () => (
    <Command className="w-80 rounded-xl border shadow-md">
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>
            <HomeIcon />
            Home
          </CommandItem>
          <CommandItem>
            <FileIcon />
            Documents
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem>
            <UserIcon />
            Profile
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <SettingsIcon />
            Preferences
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <MailIcon />
            Notifications
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Calendar">
          <CommandItem>
            <CalendarIcon />
            Today
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

// ---- Empty State ----
export const EmptyState: Story = {
  render: () => (
    <Command className="w-80 rounded-xl border shadow-md">
      <CommandInput placeholder="Search something..." defaultValue="xyznotfound" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Items">
          <CommandItem>Home</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

// ---- With Checked Item ----
export const WithCheckedItems: Story = {
  render: () => {
    const [selected, setSelected] = React.useState("home");
    return (
      <Command className="w-80 rounded-xl border shadow-md">
        <CommandInput placeholder="Search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {["home", "documents", "profile", "settings"].map((item) => (
              <CommandItem
                key={item}
                data-checked={selected === item}
                onSelect={() => setSelected(item)}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  },
};

// ---- Dialog ----
export const DialogVariant: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div>
        <Button onClick={() => setOpen(true)}>
          <SearchIcon />
          Open Command Palette
          <CommandShortcut>⌘K</CommandShortcut>
        </Button>

        <CommandDialog open={open} onOpenChange={setOpen}>
          <Command>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                <CommandItem onSelect={() => setOpen(false)}>
                  <HomeIcon />
                  Home
                </CommandItem>
                <CommandItem onSelect={() => setOpen(false)}>
                  <FileIcon />
                  Documents
                </CommandItem>
                <CommandItem onSelect={() => setOpen(false)}>
                  <MailIcon />
                  Messages
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Settings">
                <CommandItem onSelect={() => setOpen(false)}>
                  <UserIcon />
                  Profile
                  <CommandShortcut>⌘P</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => setOpen(false)}>
                  <SettingsIcon />
                  Settings
                  <CommandShortcut>⌘S</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialog>
      </div>
    );
  },
};