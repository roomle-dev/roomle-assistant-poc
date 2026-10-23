# 0002 — Configurator tools run in the SDK

Status: Accepted
Date: 2026-10-23

## Context

The configurator assistant needs the live product, native operations and their history. These
already belong to roomle-ui. The HI assistant establishes the ownership pattern: tools and
prompts ship with the iframe UI, while the host chooses the model and runs its agent.

## Decision

The native configurator dynamically loads its tool set and prompts. The embedding-lib optional
configurator entry forwards discovery/execution through normal embedding messages and runs a
shared browser agent loop. This repository owns only the static example and local model config.
SDK operations report committed history, preserving ordinary configurator undo including manual
edits. The native adapter retains interruption summaries and a five-minute turn limit.

## Alternatives

A second server-side tool implementation splits behavior across releases. Putting tools in the
host bundles SDK knowledge with every consumer. Copying the HI loop duplicates provider and
stream handling. A thin external MCP relay is possible when explicitly needed, but is not part of
this example; there is no inbound MCP endpoint.

## Consequences

The page needs both a compatible UI and the optional embedding entry. The host provider key is
visible in the browser; production provider authentication/proxying is a host decision. Tool
tests live in roomle-ui and launcher tests here. Native planner isolation uses separate tool and
window endpoints; automatic HI/native switching is a separate feature.
