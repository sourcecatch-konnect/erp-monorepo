import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "./inputOTP";

const meta: Meta<typeof InputOTP> = {
  title: "Components/InputOTP",
  component: InputOTP,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof InputOTP>;

// ---- Default 6 Digits ----
export const Default: Story = {
  render: () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

// ---- 4 Digits ----
export const FourDigits: Story = {
  render: () => (
    <InputOTP maxLength={4}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

// ---- With Separator (3 + 3) ----
export const WithSeparator: Story = {
  render: () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

// ---- With Separator (2 + 2 + 2) ----
export const WithDoubleSeparator: Story = {
  render: () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

// ---- Controlled ----
export const Controlled: Story = {
  render: () => {
    const [value, setValue] = React.useState("");
    return (
      <div className="flex flex-col items-center gap-3">
        <InputOTP maxLength={6} value={value} onChange={setValue}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <p className="text-sm text-muted-foreground">
          Value: <span className="font-medium text-foreground">{value || "—"}</span>
        </p>
      </div>
    );
  },
};

// ---- With Submit ----
export const WithSubmit: Story = {
  render: () => {
    const [value, setValue] = React.useState("");
    const [submitted, setSubmitted] = React.useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-4">
        <InputOTP
          maxLength={6}
          value={value}
          onChange={(val) => {
            setValue(val);
            setSubmitted(null);
          }}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <button
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          disabled={value.length < 6}
          onClick={() => setSubmitted(value)}
        >
          Verify
        </button>
        {submitted && (
          <p className="text-sm text-muted-foreground">
            Submitted: <span className="font-medium text-foreground">{submitted}</span>
          </p>
        )}
      </div>
    );
  },
};

// ---- Invalid ----
export const Invalid: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-2">
      <InputOTP maxLength={6} value="12345" aria-invalid={true}>
        <InputOTPGroup>
          <InputOTPSlot index={0} aria-invalid={true} />
          <InputOTPSlot index={1} aria-invalid={true} />
          <InputOTPSlot index={2} aria-invalid={true} />
          <InputOTPSlot index={3} aria-invalid={true} />
          <InputOTPSlot index={4} aria-invalid={true} />
          <InputOTPSlot index={5} aria-invalid={true} />
        </InputOTPGroup>
      </InputOTP>
      <p className="text-sm text-destructive">Invalid OTP. Please try again.</p>
    </div>
  ),
};

// ---- Disabled ----
export const Disabled: Story = {
  render: () => (
    <InputOTP maxLength={6} disabled>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};

// ---- Complete State ----
export const Complete: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-2">
      <InputOTP maxLength={6} value="123456">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <p className="text-sm text-muted-foreground">All slots filled</p>
    </div>
  ),
};