# Storybook

From the repository root, run:

```bash
pnpm --filter @skerp/ui storybook
```

Open http://localhost:6006.

### Redis Container cmd

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:latest
```
