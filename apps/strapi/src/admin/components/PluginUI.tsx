import { Box, Flex, Modal, Table, Typography } from "@strapi/design-system"
import { Page } from "@strapi/strapi/admin"
import type { ReactNode } from "react"
import { styled } from "styled-components"

/** Bounded workspaces retain Strapi's typography, controls and theme tokens. */
export const PluginPage = styled(Page.Main)`
  width: 100%;
  max-width: 1520px;
  min-width: 0;
  margin-inline: auto;
  padding-bottom: 32px;
  [role="tablist"] {
    display: flex;
    max-width: 100%;
    overflow-x: auto;
    width: max-content;
    justify-content: flex-start;
    gap: 4px;
  }
  [role="tab"] {
    flex: 0 0 auto;
    min-width: max-content;
    border-radius: 8px 8px 0 0;
    padding-inline: 20px;
  }
  @media (max-width: 700px) {
    header {
      flex-wrap: wrap;
      gap: 16px;
    }
  }
`

/** Our tables start with content, rather than Strapi's compact checkbox column. */
export const PluginTable = styled(Table)`
  min-width: 640px;
  && th,
  && td {
    padding: 16px;
    vertical-align: middle;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
  && th {
    height: auto;
    padding-block: 12px;
    white-space: nowrap;
  }
  && td {
    min-width: 120px;
    max-width: 360px;
  }
  && td:last-child {
    min-width: 80px;
  }
  && button {
    white-space: nowrap;
  }
  && td > * {
    max-width: 100%;
  }
  && tbody tr:hover {
    background: ${({ theme }) => theme.colors.neutral100};
  }
  @media (max-width: 700px) {
    && th,
    && td {
      padding-inline: 12px;
    }
  }
`

export const PluginModalContent = styled(Modal.Content)`
  width: min(1120px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 48px);
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  [data-state] {
    min-width: 0;
  }
`

export const FormGrid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 24px;
  align-items: start;
  > * {
    width: 100%;
    min-width: 0;
  }
`

export const StatsGrid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
  @media (min-width: 1500px) {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
  @media (max-width: 650px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const MemberCard = styled(Box)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px auto;
  grid-template-areas: "person role actions" "status role actions" "libraries libraries libraries";
  gap: 12px 24px;
  > [data-member-slot="person"] {
    grid-area: person;
  }
  > [data-member-slot="role"] {
    grid-area: role;
  }
  > [data-member-slot="status"] {
    grid-area: status;
  }
  > [data-member-slot="libraries"] {
    grid-area: libraries;
  }
  > [data-member-slot="actions"] {
    grid-area: actions;
  }
  @media (max-width: 650px) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: "person actions" "status status" "role role" "libraries libraries";
  }
`

export function PluginEmptyState({
  title,
  description,
  action,
}: {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}) {
  return (
    <Box background="neutral100" borderColor="neutral200" padding={7} hasRadius>
      <Flex
        direction="column"
        alignItems="center"
        gap={3}
        style={{ textAlign: "center", maxWidth: 520, marginInline: "auto" }}
      >
        <Typography tag="h3" variant="delta" textColor="neutral800">
          {title}
        </Typography>
        <Typography tag="p" textColor="neutral600" style={{ lineHeight: 1.6 }}>
          {description}
        </Typography>
        {action ? <Box paddingTop={2}>{action}</Box> : null}
      </Flex>
    </Box>
  )
}
