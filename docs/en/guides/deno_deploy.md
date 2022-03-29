---
title: 2.1 Deploy in Deno Deploy
---

> This guide is ⚠️ WORK IN PROGRESS ⚠️

# Deploy in Deno Deploy

Want to deploy a Vale project into [Deno Deploy](https://deno.land/deploy/)? It's possible!

## 1. Create Project

Let's start by cloning this repository:

```
git clone https://github.com/marc2332/vale-deno-deploy.git
```

## 2. Overview

Now, in order to deploy a Vale website in Deno Deploy we need a small Github Action workflow in order to build the website.

You can see this workflow under `.github/workflows/deploy.yml`:

```yml
name: Deploy
on: [push]

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - name: Clone repository
        uses: actions/checkout@v2

      - uses: denoland/setup-deno@v1
        with:
          deno-version: vx.x.x

      - name: Install vale
        run: deno install --allow-env --allow-read --allow-write --allow-net --unstable -n vale https://deno.land/x/vale@0.1.4/mod.ts

      - name: Build the website
        run: vale build .

      - name: Upload to Deno Deploy
        uses: denoland/deployctl@v1
        with:
          project: "YOUR_DENO_DEPLOY_PROJECT_NAME"
          entrypoint: "./docs/server.ts"
```

You must change `YOUR_DENO_DEPLOY_PROJECT_NAME` to a non-taken project name in Deno Deploy, try puting `vale-<your-nickname>`.

## 3. Create a repository in Github

You now need to create and push this project into a repository in Github.

## 4. Link in Deno Deploy

Now, go to [Deno Deploy](https://deno.land/deploy/), create a new project and link the same respository you created on Github into your Deno Deploy project.

## 5. Awesome!

Is it cool? :D