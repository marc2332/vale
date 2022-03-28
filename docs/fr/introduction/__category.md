---
title: 1. Introduction
---

> EN COURS DE DÉVELOPPEMENT ⚠️ Attendez vous à des changements importants ⚠️

# 👋 Introduction

**Vale** est un générateur de documentation statique, designé pour être rapide,
simple et lisible. Développé avec Deno, mais vous pouvez l'utiliser pour tous
vos projets. Inspiré par [Deno Manual](https://deno.land/manual) et
[mdbook](https://rust-lang.github.io/mdBook/).

Le code source est disponible sur [GitHub](https://github.com/marc2332/vale),
laissez une étoiles si vous aimez le projet ⭐ :)

## 🎉 Features

- Multi-langues supporté
- Support des blocs de code

J'ai prévu de rajouter d'autres fonctionnalités tels qu'un barre de recherche,
la possibilité d'ajouter des liens externes dans la barre latérale, un lien
"Editer sur GitHub", des tags pour les pages, la génération côté serveur (SRR),
le support de themes, un bouton pour copier les blocs de codes, ...

## 📦 Installation

Installer Vale avec Deno:

```bash
deno install --allow-env --allow-read --allow-write --allow-net --unstable -n vale https://deno.land/x/vale/mod.ts
```

Créer et lancer un projet basique :

```bash
vale init demo
vale watch demo
```

Fait par [Marc Espín](https://github.com/marc2332)

MIT License
