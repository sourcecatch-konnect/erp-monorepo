import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  SearchIcon,
  MailIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  DollarSignIcon,
  GlobeIcon,
  AtSignIcon,
} from "lucide-react";
import * as React from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./inputgroup";
const meta: Meta<typeof InputGroup> = {
  title: "Components/InputGroup",
  component: InputGroup,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof InputGroup>;

// ---- Inline Start Icon ----
export const WithStartIcon: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="inline-start">
        <InputGroupText>
          <SearchIcon />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="Search..." />
    </InputGroup>
  ),
};

// ---- Inline End Icon ----
export const WithEndIcon: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupInput placeholder="Enter email..." />
      <InputGroupAddon align="inline-end">
        <InputGroupText>
          <MailIcon />
        </InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};

// ---- Both Sides ----
export const WithBothIcons: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="inline-start">
        <InputGroupText>
          <AtSignIcon />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="username" />
      <InputGroupAddon align="inline-end">
        <InputGroupText>.com</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};

// ---- With Text Prefix ----
export const WithTextPrefix: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="inline-start">
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="yourwebsite.com" />
    </InputGroup>
  ),
};

// ---- With Currency ----
export const WithCurrency: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="inline-start">
        <InputGroupText>
          <DollarSignIcon />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput type="number" placeholder="0.00" />
      <InputGroupAddon align="inline-end">
        <InputGroupText>USD</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};

// ---- With Button (Copy) ----
export const WithCopyButton: Story = {
  render: () => {
    const [copied, setCopied] = React.useState(false);
    const ref = React.useRef<HTMLInputElement>(null);

    return (
      <InputGroup className="w-80">
        <InputGroupInput ref={ref} defaultValue="https://example.com/invite" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={() => {
              navigator.clipboard.writeText(ref.current?.value ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <CopyIcon />
            {copied ? "Copied!" : "Copy"}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
};

// ---- Password Toggle ----
export const PasswordToggle: Story = {
  render: () => {
    const [show, setShow] = React.useState(false);
    return (
      <InputGroup className="w-80">
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <GlobeIcon />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          type={show ? "text" : "password"}
          placeholder="Enter password..."
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={() => setShow(!show)}>
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
};

// ---- Block Start Label ----
export const WithBlockStartLabel: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="block-start">
        <InputGroupText>Full Name</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="John Doe" />
    </InputGroup>
  ),
};

// ---- Block End Helper ----
export const WithBlockEndHelper: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupInput placeholder="Enter username..." />
      <InputGroupAddon align="block-end">
        <InputGroupText>Must be at least 4 characters</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ),
};

// ---- With Textarea ----
export const WithTextarea: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="block-start">
        <InputGroupText>Message</InputGroupText>
      </InputGroupAddon>
      <InputGroupTextarea placeholder="Type your message here..." />
    </InputGroup>
  ),
};

// ---- Disabled ----
export const Disabled: Story = {
  render: () => (
    <InputGroup className="w-80">
      <InputGroupAddon align="inline-start">
        <InputGroupText>
          <MailIcon />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="Disabled input..." disabled />
    </InputGroup>
  ),
};

// ---- Invalid ----
export const Invalid: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-1.5">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <MailIcon />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Enter email..."
          aria-invalid={true}
          defaultValue="notanemail"
        />
      </InputGroup>
      <p className="text-xs text-destructive">Please enter a valid email.</p>
    </div>
  ),
};

// ---- All Variants ----
export const AllVariants: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText><SearchIcon /></InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="With start icon..." />
      </InputGroup>

      <InputGroup>
        <InputGroupInput placeholder="With end text..." />
        <InputGroupAddon align="inline-end">
          <InputGroupText>@gmail.com</InputGroupText>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText><DollarSignIcon /></InputGroupText>
        </InputGroupAddon>
        <InputGroupInput type="number" placeholder="0.00" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>USD</InputGroupText>
        </InputGroupAddon>
      </InputGroup>

      <InputGroup>
        <InputGroupAddon align="block-start">
          <InputGroupText>Label on top</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="Block start addon..." />
      </InputGroup>

      <InputGroup>
        <InputGroupTextarea placeholder="Textarea inside group..." />
        <InputGroupAddon align="block-end">
          <InputGroupText>Helper text below</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};