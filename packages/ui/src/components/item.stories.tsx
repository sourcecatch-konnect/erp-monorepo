import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import {
  Item,
  ItemGroup,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
  ItemSeparator,
} from "./item";

const meta: Meta<typeof Item> = {
  title: "Components/Item",
  component: Item,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Item>;

/* ---------------- Basic Item ---------------- */
export const Default: Story = {
  render: () => (
    <Item className="w-[320px]">
      <ItemContent>
        <ItemTitle>Basic Item</ItemTitle>
        <ItemDescription>
          This is a simple item with title and description.
        </ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/* ---------------- With Media ---------------- */
export const WithMedia: Story = {
  render: () => (
    <Item className="w-[320px]">
      <ItemMedia variant="icon">📦</ItemMedia>

      <ItemContent>
        <ItemTitle>Product Item</ItemTitle>
        <ItemDescription>Item with icon media on the left.</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/* ---------------- With Actions ---------------- */
export const WithActions: Story = {
  render: () => (
    <Item className="w-[320px]">
      <ItemContent>
        <ItemHeader>
          <ItemTitle>Notification</ItemTitle>

          <ItemActions>
            <button className="text-xs px-2 py-1 border rounded">
              Action
            </button>
          </ItemActions>
        </ItemHeader>

        <ItemDescription>
          This item shows header actions on the right side.
        </ItemDescription>
      </ItemContent>
    </Item>
  ),
};

/* ---------------- Full Complex Layout ---------------- */
export const FullExample: Story = {
  render: () => (
    <ItemGroup className="w-[350px]">
      <Item>
        <ItemMedia variant="image">
          <img
            src="https://via.placeholder.com/40"
            alt="img"
          />
        </ItemMedia>

        <ItemContent>
          <ItemHeader>
            <ItemTitle>User Profile</ItemTitle>
            <ItemActions>
              <button className="text-xs border px-2 py-1 rounded">
                Edit
              </button>
            </ItemActions>
          </ItemHeader>

          <ItemDescription>
            This is a full example with media, header, actions and description.
          </ItemDescription>

          <ItemFooter>
            <span className="text-xs text-gray-500">Active now</span>
            <span className="text-xs text-gray-500">2m ago</span>
          </ItemFooter>
        </ItemContent>
      </Item>

      <ItemSeparator />

      <Item>
        <ItemContent>
          <ItemTitle>Second Item</ItemTitle>
          <ItemDescription>
            Another item inside ItemGroup with separator.
          </ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  ),
};