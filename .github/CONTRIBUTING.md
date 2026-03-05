# Contributing to tek-prox

Contributions are welcome! Here's how to get started.

## Getting started

1. **Fork** the repository and create a branch from `main`
2. **Set up** your local environment following the [Getting Started](../README.md#getting-started-development) guide in the README
3. **Make your changes** — keep them focused and minimal
4. **Test** your changes locally before submitting
5. **Open a pull request** with a clear description of what you changed and why

## Guidelines

- Follow the existing code style (TypeScript strict, no `any`)
- Keep API routes thin — business logic belongs in `src/lib/`
- Do not commit `.env` files or secrets
- If you add a new feature that requires env variables, update `.env.example`

## Reporting bugs & feature requests

Open an issue and describe the problem or idea clearly. Include steps to reproduce for bugs.
