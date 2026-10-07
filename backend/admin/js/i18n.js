// Panel language (fr / en). The UI is written in English; every string that reaches the DOM goes through tr().
// Exact phrases live in FR, phrases with variable parts (names, counts) in PATTERNS. Unknown strings stay as they are.
const KEY = 'swift.admin.lang'

function detect() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch { /* storage blocked */ }
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export let lang = detect()
export const locale = () => (lang === 'fr' ? 'fr-FR' : 'en-GB')
export function setLang(l) {
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  lang = l
}

const FR = {
  // Shell and navigation
  'Swift Platform': 'Swift Platform', 'Platform admin': 'Administration', 'Search everything…': 'Tout rechercher…', 'Notifications': 'Notifications', 'No notifications': 'Aucune notification',
  'Overview': 'Vue d’ensemble', 'Dashboard': 'Tableau de bord', 'Content': 'Contenu', 'Home builder': 'Éditeur d’accueil', 'News & changelog': 'Actualités & changelog', 'Announcements': 'Annonces', 'Assets': 'Médias',
  'Network': 'Réseau', 'Servers': 'Serveurs', 'Partners': 'Partenaires', 'Campaigns': 'Campagnes', 'Launcher': 'Launcher', 'Releases': 'Versions', 'Flags & config': 'Flags & config', 'Maintenance': 'Maintenance',
  'Insights': 'Analyses', 'Analytics': 'Statistiques', 'Diagnostics': 'Diagnostics', 'Platform': 'Plateforme', 'Users & roles': 'Utilisateurs & rôles', 'Audit log': 'Journal d’audit', 'Webhooks': 'Webhooks', 'Settings': 'Paramètres',
  'Sign in': 'Se connecter', 'Sign out': 'Se déconnecter', 'Sign out everywhere': 'Se déconnecter partout', 'Username': 'Nom d’utilisateur', 'Password': 'Mot de passe', 'Swift username': 'Pseudo Swift',
  'Sign in with a Swift account that holds a platform role.': 'Connecte-toi avec un compte Swift qui possède un rôle sur la plateforme.', 'Your session expired. Please sign in again.': 'Ta session a expiré. Reconnecte-toi.',
  'Session expired': 'Session expirée', 'Signed out': 'Déconnecté', 'Sign-in failed': 'Connexion impossible', 'End this session?': 'Terminer cette session ?', 'Type at least 2 characters': 'Tape au moins 2 caractères',
  'No results': 'Aucun résultat', 'Search news, servers, partners, releases, users, flags… or jump to a page': 'Cherche une actu, un serveur, un partenaire, une version, un utilisateur, un flag… ou va à une page',
  'This page does not exist or you do not have access to it.': 'Cette page n’existe pas ou tu n’y as pas accès.', 'Something went wrong': 'Une erreur est survenue', 'Language': 'Langue',
  'Leave this page?': 'Quitter cette page ?', 'Leave': 'Quitter', 'Discard changes?': 'Abandonner les modifications ?', 'Discard': 'Abandonner', 'You have unsaved changes that will be lost.': 'Tu as des modifications non enregistrées qui seront perdues.',
  // Generic actions
  'Cancel': 'Annuler', 'Close': 'Fermer', 'Confirm': 'Confirmer', 'Continue': 'Continuer', 'Save': 'Enregistrer', 'Saved': 'Enregistré', 'Done': 'Terminé', 'Delete': 'Supprimer', 'Deleted': 'Supprimé', 'Edit': 'Modifier',
  'Open': 'Ouvrir', 'Enable': 'Activer', 'Disable': 'Désactiver', 'Retry': 'Réessayer', 'Reopen': 'Rouvrir', 'Ignore': 'Ignorer', 'Test': 'Tester', 'Stats': 'Stats', 'History': 'Historique', 'Details': 'Détails',
  'Next ›': 'Suivant ›', '‹ Prev': '‹ Préc.', 'Choose from library': 'Choisir dans la médiathèque', 'Upload image': 'Envoyer une image', 'Read only': 'Lecture seule', 'Search…': 'Rechercher…', 'Nothing here yet.': 'Rien ici pour le moment.',
  'Error': 'Erreur', 'ERROR': 'ERREUR', 'UNAUTHORIZED': 'NON AUTORISÉ', 'Request failed': 'Requête échouée', 'Name': 'Nom', 'Title': 'Titre', 'Description': 'Description', 'Status': 'Statut', 'State': 'État', 'Type': 'Type',
  'Date': 'Date', 'When': 'Quand', 'Who': 'Qui', 'Action': 'Action', 'Summary': 'Résumé', 'Value': 'Valeur', 'Key': 'Clé', 'Event': 'Événement', 'Events': 'Événements', 'Version': 'Version', 'Versions': 'Versions', 'Message': 'Message',
  'Reason': 'Motif', 'Note': 'Note', 'Order': 'Ordre', 'Window': 'Période', 'Always': 'Toujours', 'Everyone': 'Tout le monde', 'Any': 'Tous', 'Any role': 'Tous les rôles', 'Enabled': 'Activé', 'Format': 'Format', 'Link': 'Lien',
  'Image': 'Image', 'Icon': 'Icône', 'Text': 'Texte', 'Items': 'Éléments', 'Reports': 'Signalements', 'Display': 'Affichage', 'Creative': 'Visuel', 'Delivery': 'Diffusion', 'Joined': 'Inscrit', 'Updated': 'Mis à jour', 'Added': 'Ajouté',
  'Last seen': 'Dernière activité', 'Uploaded': 'Envoyé', 'Account': 'Compte', 'Accounts': 'Comptes', 'My account': 'Mon compte', 'Public URL': 'URL publique', 'URL': 'URL', 'Website': 'Site web', 'Contact': 'Contact', 'Support': 'Assistance',
  'Privacy policy': 'Politique de confidentialité', 'Status page': 'Page de statut', 'Public links': 'Liens publics', 'Discord': 'Discord', 'Subtitle': 'Sous-titre', 'Badge': 'Badge', 'Tags': 'Tags', 'Roles': 'Rôles',
  'No data yet': 'Pas encore de données', 'Preview unavailable': 'Aperçu indisponible', 'Nothing published yet': 'Rien de publié', 'Nothing published yet.': 'Rien de publié pour le moment.', 'Nothing would be shown.': 'Rien ne serait affiché.',
  // Statuses and badges
  'draft': 'brouillon', 'published': 'publié', 'scheduled': 'programmé', 'archived': 'archivé', 'active': 'actif', 'paused': 'en pause', 'ended': 'terminé', 'open': 'ouvert', 'resolved': 'résolu', 'ignored': 'ignoré', 'failed': 'échoué',
  'success': 'succès', 'pending': 'en attente', 'revoked': 'révoquée', 'on': 'activé', 'off': 'désactivé', 'live': 'en ligne', 'inactive': 'inactif', 'featured': 'à la une', 'verified': 'vérifié', 'in-game': 'en jeu', 'disabled': 'désactivé',
  'targeted': 'ciblé', 'hidden': 'masqué', 'mandatory': 'obligatoire', 'system': 'système', 'no ip': 'pas d’IP', 'unknown': 'inconnu', 'never': 'jamais', 'n/a': 'n/d', 'no note': 'sans note',
  'Draft': 'Brouillon', 'Scheduled': 'Programmé', 'Published': 'Publié', 'Archived': 'Archivé', 'Ended': 'Terminé', 'ACTIVE': 'ACTIF', 'Active': 'Actif', 'Targeted': 'Ciblé', 'Unpublished changes': 'Modifications non publiées',
  'Info': 'Info', 'Success': 'Succès', 'Warning': 'Avertissement', 'Critical': 'Critique', 'Severity': 'Gravité',
  'launcher_crash': 'plantage launcher', 'game_crash': 'plantage jeu', 'java_missing': 'Java manquant', 'java_incompatible': 'Java incompatible', 'modloader_install_failed': 'installation modloader échouée', 'auth_failed': 'authentification échouée',
  'network_error': 'erreur réseau', 'download_failed': 'téléchargement échoué', 'update_failed': 'mise à jour échouée', 'disk_space': 'espace disque', 'other': 'autre',
  'launcher crash': 'plantage launcher', 'game crash': 'plantage jeu', 'java missing': 'Java manquant', 'java incompatible': 'Java incompatible', 'modloader install failed': 'installation modloader échouée', 'auth failed': 'authentification échouée',
  'network error': 'erreur réseau', 'download failed': 'téléchargement échoué', 'update failed': 'mise à jour échouée', 'disk space': 'espace disque', 'app open': 'ouvertures de l’app', 'launch game': 'lancements du jeu', 'launch fail': 'échecs de lancement',
  'launch success': 'lancements réussis', 'home view': 'vues de l’accueil', 'news open': 'actus ouvertes', 'update applied': 'mises à jour appliquées',
  'All categories': 'Toutes les catégories', 'All channels': 'Tous les canaux', 'All editions': 'Toutes les éditions', 'All statuses': 'Tous les statuts',
  // Dashboard
  'Active (24h)': 'Actifs (24 h)', 'Active devices': 'Appareils actifs', 'Active devices (14d)': 'Appareils actifs (14 j)', 'Game launches (14d)': 'Lancements du jeu (14 j)', 'Open issues': 'Problèmes ouverts', 'News published': 'Actus publiées',
  'pseudonymous, from launcher events': 'pseudonymes, d’après les événements du launcher', 'App opens (14 days)': 'Ouvertures de l’app (14 jours)', 'Launcher versions in use': 'Versions du launcher utilisées', 'Operating systems': 'Systèmes d’exploitation',
  'Issues by category (7 days)': 'Problèmes par catégorie (7 jours)', 'Live releases': 'Versions en ligne', 'No release published yet.': 'Aucune version publiée.', 'No active campaigns.': 'Aucune campagne active.',
  'Impr.': 'Impr.', 'CTR': 'CTR', 'Clicks': 'Clics', 'Channel': 'Canal', 'Platform ': 'Plateforme ',
  'Your role has no dashboard widgets. Use the menu to open the sections you can manage.': 'Ton rôle n’a aucun widget sur le tableau de bord. Utilise le menu pour ouvrir les sections que tu peux gérer.',
  '⚒ Maintenance mode is ON: launchers are being told the service is down.': '⚒ Le mode maintenance est ACTIVÉ : les launchers savent que le service est indisponible.',
  '⚒ Maintenance is active right now.': '⚒ La maintenance est active en ce moment.',
  // Home builder
  'Compose the launcher home. Edits are drafts until you publish.': 'Compose l’accueil du launcher. Les modifications restent en brouillon tant que tu ne publies pas.',
  '+ Add section': '+ Ajouter une section', 'Add a section': 'Ajouter une section', 'Add section': 'Ajouter la section', 'Publish': 'Publier', 'Publish now': 'Publier maintenant', 'Publish the home': 'Publier l’accueil', 'Live preview': 'Aperçu en direct',
  'Drag sections to reorder.': 'Glisse les sections pour les réordonner.', 'Saved to the draft': 'Enregistré dans le brouillon', 'Home published': 'Accueil publié', 'Rolled back': 'Retour arrière effectué', 'Roll back': 'Revenir à cette version',
  'Publication history': 'Historique des publications', 'What changed? (optional)': 'Qu’est-ce qui a changé ? (facultatif)', 'Hero banner': 'Bannière principale', 'News carousel': 'Carrousel d’actus', 'Featured servers': 'Serveurs à la une',
  'Partner banners': 'Bannières partenaires', 'Image banner': 'Bannière image', 'Quick links': 'Liens rapides', 'Text block': 'Bloc de texte', 'Section title': 'Titre de la section', 'Background image': 'Image de fond',
  'Button label': 'Texte du bouton', 'Button link': 'Lien du bouton', 'Button label is required when a link is set': 'Le texte du bouton est obligatoire quand un lien est défini', 'Number of articles': 'Nombre d’articles',
  'Which servers': 'Quels serveurs', 'Featured only': 'À la une seulement', 'All enabled': 'Tous les serveurs actifs', 'Maximum': 'Maximum', 'Alt text': 'Texte alternatif', 'Show from': 'Afficher à partir du', 'Hide after': 'Masquer après le',
  'Leave empty to show immediately.': 'Laisse vide pour afficher tout de suite.', 'Links (JSON: [{label:{en},url,icon}])': 'Liens (JSON : [{label:{en},url,icon}])',
  'No section yet. Add a hero, news carousel, servers… then publish: until then the launcher keeps its built-in home.': 'Aucune section pour l’instant. Ajoute une bannière, un carrousel d’actus, des serveurs… puis publie : d’ici là, le launcher garde son accueil intégré.',
  'Draft as seen by a signed-in Windows launcher (English)': 'Brouillon tel que le voit un launcher Windows connecté (anglais)',
  'This replaces what every launcher sees. You can roll back at any time from the history.': 'Cela remplace ce que voient tous les launchers. Tu peux revenir en arrière à tout moment depuis l’historique.',
  'Delete section': 'Supprimer la section',
  // News
  'What launchers show on the home page. Scheduled items publish by themselves.': 'Ce que les launchers affichent sur la page d’accueil. Les éléments programmés se publient tout seuls.',
  '+ New article': '+ Nouvel article', '+ New entry': '+ Nouvelle entrée', 'Articles': 'Articles', 'Changelog': 'Changelog', 'No articles yet.': 'Aucun article pour le moment.', 'No changelog entries.': 'Aucune entrée de changelog.',
  'New article': 'Nouvel article', 'Edit article': 'Modifier l’article', 'Article saved': 'Article enregistré', 'Delete article': 'Supprimer l’article', 'Delete entry': 'Supprimer l’entrée', 'Publish article': 'Publier l’article', 'Archive article': 'Archiver l’article',
  'Archive': 'Archiver', 'New changelog entry': 'Nouvelle entrée de changelog', 'Summary (card text)': 'Résumé (texte de la carte)', 'Article body': 'Contenu de l’article', 'Cover image': 'Image de couverture', 'External link': 'Lien externe',
  'Optional: opens when the card is clicked.': 'Facultatif : s’ouvre au clic sur la carte.', 'Category': 'Catégorie', 'Update, Event, Community…': 'Mise à jour, Événement, Communauté…', 'Open the link directly (skip the article)': 'Ouvrir le lien directement (sans l’article)',
  'Pin to the top': 'Épingler en haut', 'Publish at': 'Publier le', 'Required for Scheduled. The news goes live by itself at that time.': 'Obligatoire pour « Programmé ». L’actu passe en ligne toute seule à cette heure.',
  'Choose a publish date for scheduled articles': 'Choisis une date de publication pour les articles programmés', 'Date (YYYY-MM-DD)': 'Date (AAAA-MM-JJ)', 'Items (JSON list of localized lines)': 'Éléments (liste JSON de lignes traduites)',
  'Faster launches': 'Lancements plus rapides', 'Feature flags & A/B tests': 'Feature flags & tests A/B',
  // Announcements
  'Banners shown at the top of the launcher: info, success, warning, critical.': 'Bandeaux affichés en haut du launcher : info, succès, avertissement, critique.', '+ New announcement': '+ Nouvelle annonce', 'New announcement': 'Nouvelle annonce',
  'Edit announcement': 'Modifier l’annonce', 'No announcements.': 'Aucune annonce.', 'Delete this announcement?': 'Supprimer cette annonce ?', 'Players can dismiss it': 'Les joueurs peuvent la fermer', 'Starts at': 'Début', 'Ends at': 'Fin',
  'Starts at (optional)': 'Début (facultatif)', 'Ends at (optional)': 'Fin (facultatif)', 'Audience': 'Audience', 'Announcement': 'Annonce',
  // Assets
  'Images used by the home, news, servers and campaigns. Served from the CDN host.': 'Images utilisées par l’accueil, les actus, les serveurs et les campagnes. Servies depuis l’hôte CDN.', 'Asset library': 'Médiathèque', 'Search assets…': 'Rechercher des médias…',
  'Search by name or alt text…': 'Rechercher par nom ou texte alternatif…', 'No assets yet. Drop images above.': 'Aucun média pour l’instant. Dépose des images ci-dessus.', 'No assets yet. Upload one in the Assets page.': 'Aucun média pour l’instant. Envoies-en un depuis la page Médias.',
  'Drop images here or ': 'Dépose des images ici ou ', 'PNG, JPEG, WebP or GIF · checked by content · identical files are deduplicated': 'PNG, JPEG, WebP ou GIF · vérifiés d’après leur contenu · les fichiers identiques sont dédoublonnés',
  'Reference (use in sections, news, servers)': 'Référence (à utiliser dans les sections, actus, serveurs)', 'Delete asset': 'Supprimer le média', 'Delete this file? It must not be used anywhere.': 'Supprimer ce fichier ? Il ne doit être utilisé nulle part.', 'Save alt text': 'Enregistrer le texte alternatif', 'browse': 'parcourir',
  // Servers / partners / campaigns
  'Servers shown in the launcher and, when flagged, in the game.': 'Serveurs affichés dans le launcher et, si marqués, dans le jeu.', '+ New server': '+ Nouveau serveur', 'New server': 'Nouveau serveur', 'Server saved': 'Serveur enregistré', 'Delete server': 'Supprimer le serveur',
  'No servers yet.': 'Aucun serveur pour le moment.', 'Edition': 'Édition', 'Java': 'Java', 'Bedrock': 'Bedrock', 'Crossplay (Java + Bedrock)': 'Crossplay (Java + Bedrock)', 'Address': 'Adresse', 'Java port': 'Port Java', 'Bedrock address': 'Adresse Bedrock', 'Bedrock port': 'Port Bedrock',
  'Only when different from the Java address.': 'Seulement si différente de l’adresse Java.', 'Hostname or IP, without scheme or port.': 'Nom d’hôte ou IP, sans schéma ni port.', 'Minimum Minecraft version': 'Version Minecraft minimale', 'Maximum Minecraft version': 'Version Minecraft maximale',
  'Banner': 'Bannière', 'Featured (shown on the launcher home)': 'À la une (affiché sur l’accueil du launcher)', 'Verified by Swift': 'Vérifié par Swift', 'Show in the in-game server list (mod)': 'Afficher dans la liste de serveurs en jeu (mod)', 'Flags': 'Flags', 'Any': 'Tous',
  'Server owners and sponsors. Campaigns hang off a partner.': 'Propriétaires de serveurs et sponsors. Les campagnes dépendent d’un partenaire.', '+ New partner': '+ Nouveau partenaire', 'New partner': 'Nouveau partenaire', 'Partner': 'Partenaire', 'Partner name': 'Nom du partenaire',
  'No partners yet.': 'Aucun partenaire pour le moment.', 'Delete partner': 'Supprimer le partenaire', 'Paused (campaigns stop)': 'En pause (les campagnes s’arrêtent)', 'Internal notes': 'Notes internes', 'No partner': 'Aucun partenaire',
  'Where and when a partner or server is promoted, with targeting and live statistics.': 'Où et quand un partenaire ou un serveur est mis en avant, avec ciblage et statistiques en direct.', '+ New campaign': '+ Nouvelle campagne', 'New campaign': 'Nouvelle campagne', 'Campaign': 'Campagne',
  'Campaign saved': 'Campagne enregistrée', 'Delete campaign': 'Supprimer la campagne', 'No campaigns yet.': 'Aucune campagne pour le moment.', 'Placement': 'Emplacement', 'Launcher home banner': 'Bannière d’accueil du launcher', 'In-game server slot (mod)': 'Emplacement serveur en jeu (mod)',
  'Launcher server list': 'Liste de serveurs du launcher', 'Required for in-game slots.': 'Obligatoire pour les emplacements en jeu.', 'Choose the server to show in the game': 'Choisis le serveur à afficher dans le jeu', '— none —': '— aucun —', 'Prio': 'Prio',
  'Priority (higher first)': 'Priorité (la plus haute d’abord)', 'Server': 'Serveur', 'Impressions': 'Impressions', 'Play attempts': 'Tentatives de jeu', 'Launches': 'Lancements', 'Launch rate': 'Taux de lancement', 'Impressions per day': 'Impressions par jour', 'Clicks per day': 'Clics par jour',
  'No Minecraft link': 'Pas de compte Minecraft lié',
  // Releases
  'Launcher versions per channel, platform and architecture. Publishing makes launchers offer the update; revoking rolls back.': 'Versions du launcher par canal, plateforme et architecture. Publier propose la mise à jour aux launchers ; révoquer fait revenir en arrière.',
  '+ New release': '+ Nouvelle version', 'New release (draft)': 'Nouvelle version (brouillon)', 'Release saved': 'Version enregistrée', 'Release revoked': 'Version révoquée', 'Publish release': 'Publier la version', 'Revoke release': 'Révoquer la version', 'Delete release': 'Supprimer la version',
  'No releases registered.': 'Aucune version enregistrée.', 'Target': 'Cible', 'Rollout': 'Déploiement', 'Release notes': 'Notes de version', 'Mandatory update': 'Mise à jour obligatoire', 'Minimum supported version': 'Version minimale supportée',
  'Clients below this are forced to update.': 'Les clients en dessous sont forcés de se mettre à jour.', 'Rollout %': 'Déploiement %', 'Staged rollout, stable per device.': 'Déploiement progressif, stable par appareil.', 'Size in bytes': 'Taille en octets',
  'Download URL (https)': 'URL de téléchargement (https)', 'SHA-256 checksum': 'Somme SHA-256', '64 hex characters': '64 caractères hexadécimaux', 'Updater signature': 'Signature de l’updater', 'Content of the .sig file; required for the in-app updater.': 'Contenu du fichier .sig ; requis pour la mise à jour intégrée.',
  '1.4.0 or 1.5.0-beta.1': '1.4.0 ou 1.5.0-beta.1', 'Architecture': 'Architecture', 'Architectures': 'Architectures', 'Platform': 'Plateforme', 'Stable': 'Stable', 'Beta': 'Bêta', 'Canary': 'Canary', 'Development': 'Développement', 'Windows': 'Windows', 'Linux': 'Linux', 'macOS': 'macOS',
  'Why is it being withdrawn?': 'Pourquoi la retirer ?', 'Launchers will stop being offered this version and get the previous published one instead.': 'Les launchers ne se verront plus proposer cette version et recevront la précédente publiée.', 'Published': 'Publié',
  // Flags, config, maintenance, settings
  'Switch launcher features on/off and tune values without a release. Data only: nothing here is ever executed.': 'Active ou coupe des fonctions du launcher et ajuste des valeurs sans nouvelle version. Données uniquement : rien ici n’est jamais exécuté.',
  'Flags & remote config': 'Flags & config distante', 'Remote config': 'Config distante', '+ New flag': '+ Nouveau flag', '+ New value': '+ Nouvelle valeur', 'New flag': 'Nouveau flag', 'New value': 'Nouvelle valeur', 'Flag': 'Flag', 'Flag saved': 'Flag enregistré',
  'No flags yet.': 'Aucun flag pour le moment.', 'No remote config values yet.': 'Aucune valeur de config distante.', 'Delete flag': 'Supprimer le flag', 'Delete value': 'Supprimer la valeur', 'Turn on': 'Activer', 'Turn off': 'Désactiver', 'A/B': 'A/B',
  'A/B variants (JSON: [{"key":"a","weight":50}])': 'Variantes A/B (JSON : [{"key":"a","weight":50}])', 'Weights are % of the targeted audience; everyone else gets "control". Leave [] for a plain flag.': 'Les poids sont des % de l’audience ciblée ; les autres reçoivent « control ». Laisse [] pour un flag simple.',
  'Value (JSON: string, number, boolean, list or object)': 'Valeur (JSON : texte, nombre, booléen, liste ou objet)', 'lowercase letters, numbers, dot, dash, underscore': 'minuscules, chiffres, point, tiret, underscore',
  'Tell every launcher the service is down, with a scheduled window and a message in each language.': 'Indique à tous les launchers que le service est indisponible, avec une plage programmée et un message dans chaque langue.', 'Maintenance mode': 'Mode maintenance',
  'When on, launchers receive maintenance.active = true and show your message.': 'Quand il est activé, les launchers reçoivent maintenance.active = true et affichent ton message.', 'Message shown to players': 'Message affiché aux joueurs',
  'Schedule the maintenance window ahead of time.': 'Programme la plage de maintenance à l’avance.', 'Launcher versions allowed through (testers)': 'Versions du launcher autorisées malgré tout (testeurs)', 'Enable maintenance': 'Activer la maintenance', 'Enable now': 'Activer maintenant',
  'Launchers will show the maintenance screen immediately. Continue?': 'Les launchers afficheront tout de suite l’écran de maintenance. Continuer ?', 'Maintenance settings saved': 'Paramètres de maintenance enregistrés', 'Enable account': 'Activer le compte', 'Disable account': 'Désactiver le compte',
  'Your account, and the platform-wide switches.': 'Ton compte et les réglages globaux de la plateforme.', 'Current password': 'Mot de passe actuel', 'New password': 'Nouveau mot de passe', 'At least 10 characters': 'Au moins 10 caractères', 'Change password': 'Changer le mot de passe',
  'Password changed. Signing you out…': 'Mot de passe modifié. Déconnexion…', 'End all your sessions on every device?': 'Terminer toutes tes sessions sur tous les appareils ?', 'Collect anonymous launcher analytics': 'Collecter des statistiques anonymes du launcher',
  'Whitelisted events only, pseudonymous device id, no IP stored. Launchers are told via bootstrap.': 'Événements autorisés uniquement, identifiant d’appareil pseudonymisé, aucune IP stockée. Les launchers sont prévenus via le bootstrap.',
  // Analytics and diagnostics
  'Aggregated, pseudonymous launcher usage. No IP address or account id is stored.': 'Usage agrégé et pseudonymisé du launcher. Aucune adresse IP ni identifiant de compte n’est stocké.', 'Minecraft versions': 'Versions de Minecraft', 'Launcher versions': 'Versions du launcher',
  'By launcher version': 'Par version du launcher', 'Languages': 'Langues', 'Locales': 'Langues', 'Launcher version ≥': 'Version du launcher ≥', 'Launcher version ≤': 'Version du launcher ≤', 'By OS': 'Par système',
  'Error reports from launchers, grouped by fingerprint. Paths, emails and tokens are scrubbed on arrival.': 'Rapports d’erreur des launchers, regroupés par empreinte. Les chemins, e-mails et jetons sont nettoyés à l’arrivée.', 'Issue': 'Problème', 'Latest reports (scrubbed)': 'Derniers rapports (nettoyés)',
  'Mark resolved': 'Marquer comme résolu', 'No error reports. 🎉': 'Aucun rapport d’erreur. 🎉', 'No reports.': 'Aucun rapport.', 'Updated ': 'Mis à jour ',
  // Users, audit, webhooks
  'Swift accounts and platform staff. Grant the first OWNER from the server console: node dist/admin.js role grant <player> OWNER.': 'Comptes Swift et équipe de la plateforme. Donne le premier OWNER depuis la console du serveur : node dist/admin.js role grant <pseudo> OWNER.',
  'No accounts match.': 'Aucun compte ne correspond.', 'Save roles': 'Enregistrer les rôles', 'Roles updated': 'Rôles mis à jour', 'Roles are applied immediately. You can only grant or revoke roles below your own rank.': 'Les rôles s’appliquent immédiatement. Tu ne peux accorder ou retirer que des rôles inférieurs au tien.',
  'Every administrative action: who, what, when, from where, with before/after state. Secrets are redacted.': 'Chaque action d’administration : qui, quoi, quand, d’où, avec l’état avant/après. Les secrets sont masqués.', 'No audit entries.': 'Aucune entrée d’audit.', 'Before': 'Avant', 'After': 'Après', 'IP': 'IP',
  'Push platform events (releases, news, maintenance…) to your tools. Signed, retried with backoff, fully logged. Discord format supported.': 'Envoie les événements de la plateforme (versions, actus, maintenance…) vers tes outils. Signés, réessayés avec délai croissant, entièrement journalisés. Format Discord pris en charge.',
  '+ New webhook': '+ Nouveau webhook', 'New webhook': 'Nouveau webhook', 'Webhook': 'Webhook', 'Webhook saved': 'Webhook enregistré', 'Delete webhook': 'Supprimer le webhook', 'No webhooks yet.': 'Aucun webhook pour le moment.', 'Deliveries': 'Livraisons', 'Attempts': 'Tentatives',
  'Generic JSON (signed)': 'JSON générique (signé)', 'Discord channel webhook': 'Webhook de salon Discord', '* = every event': '* = tous les événements', 'Secret': 'Secret', 'Signing secret': 'Secret de signature', 'Test ping queued': 'Ping de test en file d’attente',
  'No deliveries yet.': 'Aucune livraison pour le moment.', 'Copy it now: it will not be shown again. Each delivery carries X-Swift-Signature: t=<unix>,v1=HMAC_SHA256(secret, "<t>.<body>").': 'Copie-le maintenant : il ne sera plus affiché. Chaque livraison porte X-Swift-Signature: t=<unix>,v1=HMAC_SHA256(secret, "<t>.<body>").',
  // Forms: targeting, misc
  'Targeting': 'Ciblage', 'Empty = everyone. Criteria are combined with AND.': 'Vide = tout le monde. Les critères se combinent avec ET.', 'Operating system': 'Système d’exploitation', 'Channels': 'Canaux', 'Signed in only': 'Connectés uniquement', 'Signed out only': 'Non connectés uniquement',
  'Rollout % (stable per device)': 'Déploiement % (stable par appareil)', 'Minecraft versions ': 'Versions de Minecraft ', 'min e.g. 1.2.0': 'min, ex. 1.2.0', 'max e.g. 1.9.0': 'max, ex. 1.9.0', 'comma separated': 'séparés par des virgules', '+ language': '+ langue',
  'asset:… or https://…': 'asset:… ou https://…', 'name@example.com / Discord': 'nom@exemple.com / Discord', 'survival, pvp, minigames': 'survie, pvp, mini-jeux', 'Search everything': 'Tout rechercher',
}

// Phrases with variable parts. Each entry: [regex, (match) => french]. Groups that are names stay untouched; groups that are phrases go through tr().
const T = (s) => tr(s)
const PATTERNS = [
  [/^Edit (.+)$/, (m) => `Modifier ${T(m[1])}`],
  [/^New (.+)$/, (m) => `Nouveau : ${T(m[1])}`],
  [/^Delete "(.+)" permanently\?$/, (m) => `Supprimer « ${m[1]} » définitivement ?`],
  [/^Delete "(.+)" from the draft\? The live home is not affected until you publish\.$/, (m) => `Supprimer « ${T(m[1])} » du brouillon ? L’accueil en ligne n’est pas touché tant que tu ne publies pas.`],
  [/^Delete changelog (.+)\?$/, (m) => `Supprimer le changelog ${m[1]} ?`],
  [/^Delete (.+) and its statistics\?$/, (m) => `Supprimer ${m[1]} et ses statistiques ?`],
  [/^Delete (.+) and its delivery log\?$/, (m) => `Supprimer ${m[1]} et son journal de livraisons ?`],
  [/^Delete (.+)\? Launchers will see it as off\.$/, (m) => `Supprimer ${m[1]} ? Les launchers le verront comme désactivé.`],
  [/^Delete (.+)\? Its campaigns stay but lose the link\.$/, (m) => `Supprimer ${m[1]} ? Ses campagnes restent mais perdent le lien.`],
  [/^Delete (.+)\?$/, (m) => `Supprimer ${m[1]} ?`],
  [/^(Publish|Archive) "(.+)"\?$/, (m) => `${m[1] === 'Publish' ? 'Publier' : 'Archiver'} « ${m[2]} » ?`],
  [/^Allow (.+) to sign in again\?$/, (m) => `Autoriser ${m[1]} à se reconnecter ?`],
  [/^(.+) will be signed out and unable to sign in \(launcher and platform\)\.$/, (m) => `${m[1]} sera déconnecté et ne pourra plus se connecter (launcher et plateforme).`],
  [/^Roles of (.+)$/, (m) => `Rôles de ${m[1]}`],
  [/^Roll back (.+)$/, (m) => `Revenir en arrière sur ${m[1]}`],
  [/^Make snapshot #(\d+) live again and restore it as the draft\?$/, (m) => `Remettre l’instantané n°${m[1]} en ligne et le restaurer comme brouillon ?`],
  [/^Publish (.+) on (.+) for (.+)\? Matching launchers will be offered the update( \(mandatory\))?\.$/, (m) => `Publier ${m[1]} sur ${m[2]} pour ${m[3]} ? Les launchers concernés se verront proposer la mise à jour${m[4] ? ' (obligatoire)' : ''}.`],
  [/^Deliveries · (.+)$/, (m) => `Livraisons · ${m[1]}`],
  [/^(.+) · last 30 days$/, (m) => `${m[1]} · 30 derniers jours`],
  [/^Campaigns \((\d+) active, last 30 days\)$/, (m) => `Campagnes (${m[1]} active${m[1] === '1' ? '' : 's'}, 30 derniers jours)`],
  [/^Last (\d+) days$/, (m) => `${m[1]} derniers jours`],
  [/^Live · snapshot #(\d+)$/, (m) => `En ligne · instantané n°${m[1]}`],
  [/^#(\d+) · (.+)$/, (m) => `n°${m[1]} · ${T(m[2])}`],
  [/^(\d+) drafts · (\d+) scheduled$/, (m) => `${m[1]} brouillons · ${m[2]} programmés`],
  [/^(\d+) featured$/, (m) => `${m[1]} à la une`],
  [/^(\d+) failed$/, (m) => `${m[1]} échecs`],
  [/^(\d+) reports this week$/, (m) => `${m[1]} signalements cette semaine`],
  [/^(\d+) reports$/, (m) => `${m[1]} signalements`],
  [/^(\d+) in 7 days$/, (m) => `${m[1]} sur 7 jours`],
  [/^(\d+) new this week$/, (m) => `${m[1]} nouveaux cette semaine`],
  [/^(\d+) sections$/, (m) => `${m[1]} sections`],
  [/^(\d+) permissions$/, (m) => `${m[1]} permissions`],
  [/^(\d+) items? · page (\d+)\/(\d+)$/, (m) => `${m[1]} éléments · page ${m[2]}/${m[3]}`],
  [/^(\d+) items?$/, (m) => `${m[1]} élément${m[1] === '1' ? '' : 's'}`],
  [/^(\d+) item\(s\)$/, (m) => `${m[1]} élément(s)`],
  [/^page (\d+)\/(\d+)$/, (m) => `page ${m[1]}/${m[2]}`],
  [/^\+(\d+) more$/, (m) => `+${m[1]} de plus`],
  [/^(\d+)([smhd]) ago$/, (m) => `il y a ${m[1]} ${{ s: 's', m: 'min', h: 'h', d: 'j' }[m[2]]}`],
  [/^(.+) \((.+ ago|never)\) · (.+) · (\d+) sections$/, (m) => `${m[1]} (${T(m[2])}) · ${T(m[3])} · ${m[4]} sections`],
  [/^(.+) · (.+) · (.+) · request (.+)$/, (m) => `${m[1]} · ${T(m[2])} · ${T(m[3])} · requête ${m[4]}`],
  [/^first (.+) · last (.+)$/, (m) => `premier ${m[1]} · dernier ${m[2]}`],
  [/^Swift Platform (\S+) · (\S+) · updated (.+)$/, (m) => `Swift Platform ${m[1]} · ${m[2]} · mis à jour ${T(m[3])}`],
  [/^Welcome back, (.+)$/, (m) => `Bon retour, ${m[1]}`],
  [/^Raw events are kept (\d+) days; daily counters are kept longer\.$/, (m) => `Les événements bruts sont conservés ${m[1]} jours ; les compteurs quotidiens plus longtemps.`],
  [/^(.+) is required$/, (m) => `${T(m[1])} est obligatoire`],
  [/^(.+): invalid JSON$/, (m) => `${T(m[1])} : JSON invalide`],
  [/^(.+) uploaded$/, (m) => `${m[1]} envoyé`],
  [/^(.+) saved$/, (m) => `${T(m[1])} enregistré`],
  [/^Request failed \((\d+)\)$/, (m) => `Requête échouée (${m[1]})`],
  [/^(\S{1,2})  (.+)$/, (m) => `${m[1]}  ${T(m[2])}`],
  [/^(\d+(?:\.\d)?) MB$/, (m) => `${m[1].replace('.', ',')} Mo`],
  [/^(\d+) KB$/, (m) => `${m[1]} Ko`],
  [/^(.+) · (\d+(?:\.\d)?) MB$/, (m) => `${m[1]} · ${m[2].replace('.', ',')} Mo`],
  [/^(.+) · (\d+) KB$/, (m) => `${m[1]} · ${m[2]} Ko`],
]

// Messages the API sends (error.message). Shown translated when the panel is in French.
Object.assign(FR, {
  ' (you)': ' (toi)', 'signed in': 'connexion', 'signed out': 'déconnexion', 'page': 'page', 'news': 'actu', 'server': 'serveur', 'partner': 'partenaire', 'campaign': 'campagne', 'release': 'version', 'user': 'utilisateur', 'asset': 'média', 'flag': 'flag',
  'Invalid username or password': 'Pseudo ou mot de passe incorrect', 'Authentication required': 'Authentification requise', 'You do not have permission to do this': 'Tu n’as pas la permission de faire ça',
  'Invalid or expired token': 'Jeton invalide ou expiré', 'Session ended': 'Session terminée', 'Account unavailable': 'Compte indisponible', 'Too many failed attempts, try again later': 'Trop de tentatives échouées, réessaie plus tard',
  'Too many requests, slow down': 'Trop de requêtes, ralentis', 'This account has no access to the admin platform': 'Ce compte n’a pas accès à la plateforme d’administration', 'Invalid request body': 'Corps de requête invalide',
  'Invalid query parameters': 'Paramètres invalides', 'Invalid JSON body': 'JSON invalide', 'Request body too large': 'Requête trop volumineuse', 'Route not found': 'Route introuvable', 'Resource not found': 'Ressource introuvable',
  'Current password is incorrect': 'Le mot de passe actuel est incorrect', 'You cannot change your own roles': 'Tu ne peux pas modifier tes propres rôles', 'You cannot disable your own account': 'Tu ne peux pas désactiver ton propre compte',
  'The last OWNER cannot be removed': 'Le dernier OWNER ne peut pas être retiré', 'Archive published news before deleting it': 'Archive une actu publiée avant de la supprimer', 'Already published': 'Déjà publié',
  'Only drafts can be edited; publish a new version instead': 'Seuls les brouillons sont modifiables ; publie plutôt une nouvelle version', 'Only published releases can be revoked': 'Seules les versions publiées peuvent être révoquées',
  'Revoke a published release instead of deleting it': 'Révoque une version publiée au lieu de la supprimer', 'This version already exists for this channel, platform and architecture': 'Cette version existe déjà pour ce canal, cette plateforme et cette architecture',
  'Unsupported file: only PNG, JPEG, WebP and GIF images are accepted': 'Fichier non pris en charge : seules les images PNG, JPEG, WebP et GIF sont acceptées', 'Missing "file" field': 'Champ « file » manquant',
  'Expected multipart/form-data': 'multipart/form-data attendu', 'ids must list every section exactly once': 'ids doit lister chaque section exactement une fois', 'Section configuration is too large': 'La configuration de la section est trop volumineuse',
  'Invalid request': 'Requête invalide', 'JWT_SECRET is not configured: platform sign-in is disabled': 'JWT_SECRET n’est pas configuré : la connexion à la plateforme est désactivée',
})

let miss = null
export function trackMisses() { miss = new Set(); return miss }

/** Translate a UI string. English mode, empty strings and unknown phrases are returned untouched. */
export function tr(s) {
  if (lang !== 'fr' || typeof s !== 'string' || s.length === 0) return s
  const hit = FR[s]
  if (hit !== undefined) return hit
  for (const [re, fn] of PATTERNS) {
    const m = re.exec(s)
    if (m) return fn(m)
  }
  if (miss && /[A-Za-z]{3,}/.test(s)) miss.add(s)
  return s
}
