Exemple 1 : Une page AVEC onMounted (Ex: Dashboard.vue)
Quand l'utilisateur arrive sur le Dashboard, il veut voir les graphiques tout de suite. Il ne veut pas cliquer sur un bouton pour les afficher. On utilise donc onMounted pour charger les données

Exemple 2 : Une page SANS onMounted (Ex: ResetData.vue)
Sur la page de réinitialisation, on ne veut surtout pas vider la base de données automatiquement dès que la page s'ouvre ! On veut attendre que l'utilisateur clique volontairement sur le bouton.
-----------------------------------------------------------
Le mot-clé export default est une règle de communication en JavaScript. En termes simples, il signifie : "Voici l'élément principal et officiel de ce fichier."

Quand un autre fichier décidera d'importer ce dossier, c'est cet élément précis qu'il recevra en premier, automatiquement, et sans avoir besoin d'utiliser de pinces (les accolades {}).