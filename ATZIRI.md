# Atziri Exchange

Version personnelle d'[Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (licence MIT, voir `LICENSE`), habillée avec le thème de l'outil **Atziri Regex** et enrichie d'une page Shift+Espace. La base (vérification des prix, filtres, raccourcis) est celle de l'original, version 0.16.3.

## Ce qui change par rapport à l'original

### Apparence
- Nom « Atziri Exchange », icône et logo d'Atziri (installateur, programme, écran de lancement).
- Thème « braise » d'Atziri Regex, modifiable dans Paramètres > Atziri réglage : 4 thèmes (Braise, Vaal, Sang, Délire), 6 couleurs réglables avec une palette prête à l'emploi.
- Images de fond au choix pour Shift+Espace et pour la fenêtre de prix (Temple d'Atziri, Reine Atziri, aucune ou une image importée).

### Page Shift+Espace
- Grand cadre redimensionnable (poignée dans le coin bas-droit, double-clic pour revenir à la taille d'origine).
- Onglets : **Economy** (prix poe.ninja en direct, favoris, alertes de prix, catégories déplaçables, uniques ouverts sur le trade), **PoEDB**, **Craft**, **poe.ninja**, **Trade** et **Historique** (icône à droite : derniers Ctrl+D et suivi de rentabilité).
- Convertisseur Divine / Chaos / Exalté en haut à droite.
- Bloqueur de pub et de traqueurs (Ghostery) dans les onglets web uniquement.
- Bouton Paramètres intégré au cadre. La petite fenêtre flottante, XP, Map rolling, Dump sorting, Cheat sheets et la recherche d'objets ont été retirés.

### Comportement
- Ctrl+D lance la recherche tout de suite, en Achat instantané, avec le prix « Exalté ou Divin ».
- Site de trade en anglais (www.pathofexile.com) par défaut ; modifiable dans Paramètres > Général.
- Fenêtre de prix : gros prix en haut avec indicateur de fiabilité (nombre d'annonces, dispersion) et « À vendre ≈ X » (5 % sous l'annonce sérieuse la moins chère) ; les annonces anormalement basses (moins de la moitié de la médiane des suivantes, au plus un tiers de l'échantillon) sont ignorées. Lignes de mods cliquables en entier, rangées en groupes repliables (Propriétés, Augmentations, Implicites, Préfixes, Suffixes), Augmentations décochées par défaut, case « Valeur exacte ». La recherche se relance seule environ 1 s après le dernier changement.
- Langue : tous les textes ajoutés par Atziri suivent la langue choisie (français si « Français », anglais sinon). Les onglets PoEDB et Craft s'ouvrent dans cette langue, le Trade passe sur www.pathofexile.com en anglais. Les noms d'objets et de mods restent ceux du jeu.
- L'overlay se ferme tout seul 5 s après la fermeture du jeu, et s'arrête proprement quand Windows s'éteint ou redémarre.
- Option « Lancer avec le jeu » (Atziri réglage) : démarrage discret avec Windows, l'overlay reste prêt après la fermeture du jeu.
- Langue du jeu détectée toute seule : si un objet copié n'est pas dans la langue réglée, l'overlay passe dans la langue du jeu et relance la vérification.
- Dossier `partage\` : installateur + LISEZ-MOI.txt, zippés dans `Atziri Exchange.zip`, à envoyer à un ami.
- Le raccourci PoEDB ouvre la fiche dans l'onglet PoEDB de Shift+Espace.
- Paramètres : première page « Atziri réglage » qui regroupe les réglages les plus utilisés.
- Configuration par défaut : celle de l'utilisateur.
- Listes d'objets et de mods mises à jour automatiquement depuis GitHub (vérification toutes les 3 h, fichiers validés avant usage, utilisés au démarrage suivant ou tout de suite avec « Appliquer maintenant »).
- Vérifie aussi la dernière version d'Exiled Exchange 2 et signale dans Atziri réglage quand une nouvelle version du code est sortie (à intégrer à la main dans ce fork).
- Economy : catégories et lignes lues en direct ; une catégorie inconnue reçoit un nom traduit mot à mot et l'icône de son premier objet.
- Mises à jour automatiques de l'appli désactivées (l'original remplacerait cette version). À la place, l'overlay vérifie les Releases du dépôt kinetrex123-boop/atziri-exchange et affiche un avis (Shift+Espace et Atziri réglage) quand un installateur plus récent est publié. Pour publier une nouvelle version : augmenter `ATZIRI_BUILD` dans `main/src/atziri-data.ts` et nommer la Release `v0.16.3-atziri.<numéro>`. L'avis ne fonctionne que si le dépôt est public.

### Sécurité
- Le serveur local de l'appli (port fixe 41917, uniquement sur la machine) refuse toute requête venant d'un autre site web que la page de l'appli, y compris la connexion d'évènements qui peut taper au clavier dans le jeu.
- Les onglets web n'ont aucun accès à l'appli : pas de Node, isolés, cookies séparés, uniquement des pages http(s), pop-ups ouvertes dans le même onglet.

## Compiler

Il faut Node.js. Le plus simple : `construire.bat`.

Étapes manuelles (l'icône d'Atziri est posée sur le .exe par `main/build/after-pack.cjs`) :

```
cd renderer && npm install && npm run make-index-files && npm run build
cd ../main && npm install && npm run build
npx electron-builder build --win nsis --publish never
```

L'installateur est créé dans `main\dist`. N'utilise pas Exiled Exchange 2 et Atziri Exchange en même temps : les deux interceptent les mêmes raccourcis.
