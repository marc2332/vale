---
title: 1. Introduction
---

> WORK IN PROGRESS ⚠️ Expect breaking changes ⚠️

# 👋 Introduction

**Vale** is a static documentation generator, designed for speed, simplicity and
readability. Built with Deno, but you can use it for any project. Inspired by
[Deno Manual](https://deno.land/manual) and
[mdbook](https://rust-lang.github.io/mdBook/).

Source code is on [GitHub](https://github.com/marc2332/vale), please leave a star if you liked it ⭐ :)

## 🎉 Features

- Multiple languages
- Code blocks support

I plan to add other features such as a searcher, third-party links on the
navbar, "Edit on Github" link, page tags, SSR, themes, copy button in code
blocks, etc...

## 📦 Installation

Install Vale with Deno:

```bash
deno install --allow-env --allow-read --allow-write --allow-net --unstable -n vale https://deno.land/x/vale/mod.ts
```

Create and run a basic project:

```bash
vale init demo
vale watch demo
```

Made by [Marc Espín](https://github.com/marc2332)

MIT License
