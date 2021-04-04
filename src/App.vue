<!--
App.vue a la strucyure suivante :
- Une entête,
- un panneau à gauche : version de l'application et option de quitter
- un panneau droite ; gestion des fichiers et import depuis Odoo
- la zone centrale qui affiche les articles correspondants au filtre souhaité.
- une barre de statut en bas.
-->

<template>
   <q-layout id="q-app" view="hHh lpR fFf" class="text-grey-3 bg-green-10">
    <!-- Entête -->
    <q-header elevated>
      <q-toolbar class="row q-py-md bg-black text-white">
        <!-- Menu général, panneau gauche -->
        <q-btn :size="standardBtnSize" flat round @click="ouvrirMenu()" icon="menu" color="grey-2" aria-label="Menu"/>
        <q-toolbar-title v-if="fichier">{{ fichier.label  }}</q-toolbar-title>
        <q-toolbar-title v-else>(Choisir un fichier à visualiser)</q-toolbar-title>
        <q-btn v-if="fichier" class="q-mx-xs" :size="standardBtnSize" color="primary" text-color="white" @click="ajouterArticle()" icon="add_circle">Ajouter<br>un article</q-btn>
        <q-btn v-if="fichier" class="q-mx-xs" :size="standardBtnSize" color="white" text-color="blue-10" @click="enreg = true" icon="check_circle">Enregistrer<br>comme modèle</q-btn>
        <q-btn v-if="fichier" class="q-mx-xs" :size="standardBtnSize" color="white" text-color="blue-10" @click="envoyer()" icon="send">Mettre<br>en service</q-btn>
        <!-- on ne peut détruire qu'un modèle, pas une archive ou un nouveau fichier ou un l'image chargée de ODOO -->
        <q-btn v-if="fichier && fichier.nom && !fichier.nom.startsWith('$') && !fichier.arch" class="q-mx-xs" :size="standardBtnSize" color="negative" text-color="white" @click="detruiremodele = true" icon="delete">Supprimer<br>ce modèle</q-btn>
      </q-toolbar>
      <!-- Critères de filtre et de tri -->
      <div v-if="fichier" class="col row justify-center items-center q-gutter-md q-pa-sm bg-grey-9">
        <!-- Critères de tri prédéfinis -->
        <q-select style="min-width:10rem" color="black" bg-color="grey-1" filled bottom-slots v-model="tri" :options="optionsTri" label="Critère de tri" dense options-dense >
          <template v-slot:prepend>
            <q-icon name="sort" @click.stop />
          </template>
        </q-select>
        <!-- Critères de sélections prédéfinis -->
        <q-select style="min-width:25rem" color="black" bg-color="grey-1" filled bottom-slots v-model="filtre" :options="optionsFiltre" label="Critère de filtre" dense options-dense >
          <template v-slot:prepend>
            <q-icon name="filter_list" @click.stop />
          </template>
        </q-select>
        <!-- Paramètre du tri, selon le critère choisi -->
        <q-input style="min-width:6rem;position:relative;top:-0.9rem" color="black" bg-color="grey-1" dense filled v-model="argFiltre" label="argument ..."/>
      </div>
    </q-header>

    <!-- Menu gauche -->
    <q-drawer v-model="panneauGauche" elevated overlay :width="500" bordered content-dense>
      <!-- Le bouton fermer n'est pas visible quand le panneau est fermé -->
      <q-btn v-if="panneauGauche" class="btnfermer btnfermerg" @click="panneauGauche = false" :size="standardBtnSize" round unelevated color="accent" icon="chevron_left"/>
      <!-- Le menu comporte deux listes qui pourraient faire qu'il ne soit pas entièrement visible -->
      <q-scroll-area class="fit text-black">
        <q-list>
          <!-- La version de l'application n'est pas pertinente en test (c'est celle de Quasar qui s'affiche dans ce cas) mais est coorecte en production -->
          <q-item>
            <div class="text-h6 bold">Version de l'application : {{ version }}</div>
          </q-item>
          <q-item clickable class="bg-grey-1" v-ripple @click="exitApp = true">
            <q-item-section avatar><q-icon class="menuButton negative" :name="'exit_to_app'"/></q-item-section>
            <q-item-section class="menuText negative">Quitter l'application</q-item-section>
          </q-item>
          <q-separator />
          <!-- Ouverture du fichier actuellement en service -->
          <q-item clickable class="bg-grey-1" v-ripple @click="ouvrirFichier()">
            <q-item-section avatar><q-icon class="menuButton" :name="'today'"/></q-item-section>
            <q-item-section class="menuText primary">En service actuellement</q-item-section>
          </q-item>
          <!-- Importation d'un fichier CSV local dont le nom sera pris comme nom de modèle-->
          <q-item clickable class="bg-grey-1" v-ripple @click="fichierlocal = true;fichierImport = null;panneauGauche = false">
            <q-item-section avatar><q-icon class="menuButton" :name="'add_box'"/></q-item-section>
            <q-item-section class="menuText">Importer un fichier local comme modèle</q-item-section>
          </q-item>
          <!-- Création d'un fichier nouveau ne comportant qu'une ligne d'entête et un produit 'fake' -->
         <q-item clickable class="bg-grey-1" v-ripple @click="panneauGauche = false;nouveauFichier()">
            <q-item-section avatar><q-icon class="menuButton" :name="'add_box'"/></q-item-section>
            <q-item-section class="menuText">Créer un nouveau modèle</q-item-section>
          </q-item>
          <q-separator />
          <!-- Liste des archives des dernières mises en service -->
          <q-item class="column">
            <div v-if="this.lstArch.length == 0" class="col-auto titre1">Pas de mise à jour archivées</div>
            <div v-else>
              <div class="col-auto titre1">Dernières mises en service</div>
              <div class="col-auto fichier" v-for="f in lstArch" :key="f" @click="ouvrirFichier(f,true)">{{ f }}</div>
            </div>
          </q-item>
          <q-separator />
          <!-- Liste des modèles conservés localement -->
          <q-item class="column">
            <div v-if="this.lstMod.length == 0" class="col-auto titre1">Pas de modèles enregistrés</div>
            <div v-else>
              <div class="col-auto titre1">Modèles enregistrés</div>
              <div class="col-auto fichier" v-for="f in lstMod" :key="f" @click="ouvrirFichier(f)">{{ f }}</div>
            </div>
          </q-item>
          <q-separator />
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <!-- Zone des articles -->
    <q-page-container>
      <div v-if="selArticles.length === 0" class="pasArticles" style="height:100vh;margin-top:40vh">
        {{ chargement ? 'Chargement en cours ...' : 'Pas d\'articles' }}
      </div>
      <div v-else style="width:100%">
        <!-- Le clic sur un article ouvre le panneau d'édition de l'article -->
        <div v-for="(a, index) in selArticles" :key="index" @click="clicArticle(a, index)">
          <carte-article :article="a"></carte-article>
        </div>
      </div>
    </q-page-container>

    <!-- Pied de page statistique -->
    <q-footer elevated class="q-py-md bg-black text-white status">
      <div v-if="!fichier || !articles.length">0 article</div>
      <div v-else class="row">
        <div class="q-px-xs">{{ articles.length }} article(s) - </div>
        <div class="q-px-xs">{{ selArticles.length }} article(s) filtrés - </div>
        <div v-if="fichier.nbcrees !== 0" class="q-px-xs">{{ fichier.nbcrees }} créé(s) - </div>
        <div v-if="fichier.nbmodifies !== 0" class="q-px-xs">{{ fichier.nbmodifies }} modifié(s) - </div>
        <div v-if="fichier.nbsupprimes !== 0" class="q-px-xs">{{ fichier.nbsupprimes }} supprimé(s) - </div>
        <div v-if="fichier.nberreurs !== 0" class="q-px-xs artErr">{{ fichier.nberreurs }} en erreur(s) - </div>
        <div v-if="fichier.doublons.length !== 0" class="q-px-xs artErr">{{ fichier.doublons.length }} doublon(s) de code article - </div>
      </div>
    </q-footer>

    <!-- Dialogue d'enregistrement du fichier courant comme modèle -->
    <q-dialog v-model="enreg" class="modeleDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Enregistrement comme modèle</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="nomModele"
            label="Nom du modèle"
            clearable
            clear-icon="close"
            :rules="[ val => b64u(val, 4, 32) || 'De 4 à 32 minuscules (a-z), majuscules (A-Z), chiffres (0-9), tiret (-), tiret bas (_)']"
            >
            <template v-slot:hint>
            De 4 à 32 minuscules (a-z), majuscules (A-Z), chiffres (0-9), tiret (-), tiret bas (_)
            </template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn size="1.5rem" label="Annuler" color="negative" v-close-popup />
          <q-btn size="1.5rem" label="Valider" :disable="!b64u(nomModele, 4, 32)" color="positive" @click="enregModele()" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialogue de sélection du fichier CSV à importer comme modèle -->
    <q-dialog v-model="fichierlocal" class="modeleDialog">
      <q-card>
        <q-card-section>
          <q-file v-model="fichierImport" label="Choisir le fichier à importer" style="width:30rem;"/>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn size="1.5rem" flat label="Je renonce" color="negative" v-close-popup />
        </q-card-actions>
     </q-card>
    </q-dialog>

    <q-dialog v-model="envoye">
      <q-card>
        <q-card-section>
          <div class="text-h6">Mise en service du fichier</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div v-if="dhArchivage">Le fichier a été mis en service, sauvé et archivé sous le nom {{ dhArchivage }}</div>
          <div v-else>Le fichier n'a pas été mis en service, l'actuel ayant déjà exactement le même contenu.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn size="1.5rem" flat label="J'ai lu" color="negative" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Boîte de dialogue d'alerte avec simple confirmation de lecture du message -->
    <q-dialog v-model="alerte">
      <q-card>
        <q-card-section>
          <div class="text-h6">Erreur</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          {{ texteAlerte }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn size="1.5rem" flat label="J'ai lu" color="negative" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Boîte de dialogue d'information avec simple confirmation de lecture du message -->
    <q-dialog v-model="info">
      <q-card>
        <q-card-section>
          <div class="text-h6">Information</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          {{ texteAlerte }}
        </q-card-section>
        <q-card-actions align="right">
          <q-btn size="1.5rem" flat label="J'ai lu" color="positive" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

  <!-- Boîte de dialogue de confirlation de sortie de l'application -->
    <q-dialog v-model="exitApp" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="exit_to_app" color="negative" text-color="white"/>
          <span class="q-ml-sm dialogText">Voulez-vous vraiment quitter l'application ?</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Non, je la garde active" color="primary" v-close-popup
            @click="exitApp = false; panneauGauche = false"/>
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Oui, je l'arrête" color="negative" v-close-popup
            @click="quit()"/>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Boîte de dialogue demandant confirmation de la perte des éditions non sauvées et non mises en service -->
    <q-dialog v-model="perdreModif" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="block" color="negative" text-color="white"/>
          <span class="q-ml-sm dialogText">Le fichier affiché a été modifié et n'a pas été sauvé comme modèle ni mis en service. Voulez-vous vraiment perdre les changements ?</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Non, je le garde ouvert" color="primary" v-close-popup
            @click="perdreModif = false;resolveFichier(false)"/>
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Oui, je perd les modifications" color="negative" v-close-popup
            @click="perdreModif = false;resolveFichier(true)"/>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialogue demandant confirmation de la destruction d'un modèle -->
    <q-dialog v-model="detruiremodele" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="block" color="negative" text-color="white"/>
          <span class="q-ml-sm dialogText">Voulez-vous vraiment détruire le modèle [{{ fichier ? fichier.nom : '?' }}] ?</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Non, je le garde" color="primary" v-close-popup
            @click="detruiremodele = false"/>
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Oui, je le détruis" color="negative" v-close-popup
            @click="detruiremodele = false;detruire()"/>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Boîte de dialogue demandant confirmation de la mise en service du fichier apparaissant à l'écran -->
    <q-dialog v-model="envoyerfichier" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="block" color="negative" text-color="white"/>
          <span v-if="fichier && fichier.nom ? true : false" class="q-ml-sm dialogText">Voulez-vous vraiment mettre en service ce fichier [{{ fichier.nom }}] ?</span>
          <span v-else class="q-ml-sm dialogText">Voulez-vous vraiment mettre ce fichier en service ?</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Non, je ne le mets pas en service" color="primary" v-close-popup
            @click="envoyerfichier = false"/>
          <q-btn :size="largeBtnSize" class="dialogText" flat label="Oui, je le mets en service" color="negative" v-close-popup
            @click="envoyerfichier = false;envoyer2()"/>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <fiche-article></fiche-article>
   </q-layout>
</template>

<script>
import { global, b64u, removeDiacritics } from './app/global'
import { config } from './app/config'
import { checkDirs, Fichier, listeArchMod, copieFichier, colonnes, defVal, decore } from './app/fichier'
import CarteArticle from './components/CarteArticle.vue'
import FicheArticle from './components/FicheArticle.vue'

// Liste des critères de filtres des articles
const optionsFiltre = [
  'Tous',
  'En erreur',
  'Bio',
  'Non bio',
  'A l\'unité',
  'Au Kg',
  'Sans image',
  'Avec image de largeur > à ...',
  'Dont le code commence par ...',
  'Dont le code barre commence par ...',
  'Dont le code court est ...',
  'Dont le nom contient ...',
  'Dont le nom commence par ...',
  'Créés',
  'Modifiés',
  'Supprimés',
  'Inchangés',
  'Doublons de code article',
  'Ayant un code court fixé'
]

export default {
  name: 'App',

  components: { CarteArticle, FicheArticle },

  /*
  Le fichier ouvert par défaut est le fichier actuellement en service.
  S'il n'existe pas, une alerte apparaît mais il n'y a aucun fichier courant.
  */
  async mounted() {
    global.appVue = this

    const e = checkDirs()
    if (e) {
      config.msgbox('Erreur fatale d\'installation', e, true)
    }

    this.fichier = new Fichier()
    try {
      this.chargement = true
      this.articles = await this.fichier.lire()
      this.filtrer()
      this.chargement = false
    } catch (e) {
      this.chargement = false
      this.erreur('Le fichier des articles [articles.csv] est corrompu ou inaccessible.', e.message)
    }
  },

  data () {
    return {
      version: config.version,
      chargement: false, // vrai si le chargement des articles est en cours
      fichier: null, // objet fichier "courant". Peut-être null à l'ouverture s'il n'y a pas de fichier mis en service
      modifie: false, // vrai si le fichier courant a subi au moins une édition
      lstArch: [], // liste des noms des fichiers archivés (historique des dernières mises en service)
      lstMod: [], // liste des fichiers modèles gardés pour mémoire, être retravaillés, etc.
      largeBtnSize: '1.5rem', // taille d'un grand bouton
      standardBtnSize: '1rem', // taille d'un bouton standard
      panneauGauche: false, // model contrôlant l'ouverture du menu (panneau gauche)
      perdreModif: false, // model contrôlant l'ouverture du dialogue demandant confirmation pour la perte des éditions en cours
      detruiremodele: false, // model contrôlant l'ouverture du dialogue demandant confirmation pour la destruction d'un fichier modèle
      envoyerfichier: false, // model contrôlant l'ouverture du dialogue demandant confirmation pour mettre en service le fichier courant
      fichierlocal: false, // model contrôlant l'ouverture du dialogue de choix d'un fichier local à importer comme modèle
      envoye: false, // model contrôlant l'ouverture du dialogue notifiant de la mise en service du fichier courant
      exitApp: false, // model contrôlant l'ouverture du dialogue demandant confirmation de la sortie de l'application
      alerte: false, // model contrôlant l'ouverture du dialogue d'affichage d'une alerte
      info: false, // model contrôlant l'ouverture du dialogue d'affichage d'une information
      enreg: false, // model contrôlant l'ouverture du dialogue informant de l'enregistrement du fichier courant
      dhArchivage: '', // date-heure d'archivage (mise en service du fichier courant)
      texteAlerte: '', // texte de l'alerte à afficher
      fichierImport: null, // objet "file" de sélection d'un fichier local
      articles: [], // liste des articles du fichier courant
      selArticles: [], // liste des articles sélectionnés par mi ceux de articles[]
      index: 0, // index de l'article courant dans articles[]. Elle ne change pas.
      position: 0, // index de l'article courant dans selArticles[] (sa position dans la sélection). Elle change selon la sélection/tri actuels
      nomModele: '', // nom (fileName) du fichier modèle
      tri: 'Numéro de ligne', // critère de tri courant
      itri: 0, // indice du critère de tri dans la liste des critères
      optionsTri: ['Numéro de ligne', 'Code de l\'article', 'Nom (alphabétique)', 'Code barre', 'Code court à 2 lettres'],
      filtre: 'Tous', // critère de filtre
      ifiltre: 0, // indice du critère de filtre dans la liste
      optionsFiltre: optionsFiltre,
      argFiltre: '' // paramètre optionnel du critère de filtre actuel (tous n'en n'ont pas un)
    }
  },

  watch: {
    // détection de la sélection d'un fichier dans le dialogue de sélection
    fichierImport (apres) {
      this.fichierlocal = false
      if (apres) {
        this.importFichier(apres.name, apres.path)
        this.fichierImport = null
      }
    },
    // détection du changement de critère de tri
    tri (option, avant) {
      this.itri = this.optionsTri.indexOf(option)
      if (this.itri !== -1 && option !== avant) { this.trier() }
    },
    // détection du changement de critère de filtre
    filtre (option, avant) {
      this.ifiltre = this.optionsFiltre.indexOf(option)
      if (this.ifiltre !== -1 && option !== avant) { this.filtrer() }
    },
    // détection du changement de valeur du paramètre optionnel du critère de filtre courant
    argFiltre (option, avant) {
      if (option !== avant) { this.filtrer() }
    }
  },

  methods: {
    quit () { config.quit() },

    // test si un nom est de longueur entre 4 et 32 et ne comporte que des caractères a-ZA-Z0-9-_
    b64u (val) { return b64u(val, 4, 32) },

    // tri des articles selon le critère demandé
    trier () {
      let c = this.itri
      // optionsTri: ['Numéro de ligne', 'Code de l\'article', 'Nom (alphabétique)', 'Code barre', 'Code court à 2 lettres']
      switch (c) {
        case 0 : { this.selArticles.sort((a, b) => { return a.n > b.n ? 1 : (a.n < b.n ? -1 : 0) }); break }
        case 1 : { this.selArticles.sort((a, b) => { return a.id > b.id ? 1 : (a.id < b.id ? -1 : 0) }); break }
        case 2 : { this.selArticles.sort((a, b) => { return a.nom > b.nom ? 1 : (a.nom < b.nom ? -1 : 0) }); break }
        case 3 : { this.selArticles.sort((a, b) => { return a['code-barre'] > b['code-barre'] ? 1 : (a['code-barre'] < b['code-barre'] ? -1 : 0) }); break }
        case 4 : { this.selArticles.sort((a, b) => { return a.codeCourt > b.codeCourt ? 1 : (a.codeCourt < b.codeCourt ? -1 : 0) }) }
      }
    },

    // sélection des articles selon le critère de filtre courant et la valeur de son argument éventuel
    filtrer () {
      /*
      0 'Tous',
      1 'En erreur',
      2 'Bio',
      3 'Non bio',
      4 'A l\'unité',
      5 'Au Kg',
      6 'Sans image',
      7 'Avec image de largeur > à ...',
      8 'Dont le code commence par ...',
      9 'Dont le code barre commence par ...',
      10 'Dont le code court est ...',
      11 'Dont le nom contient ...',
      12 'Dont le nom commence par ...',
      13 'Créés',
      14 'Modifiés',
      15 'Supprimés'
      16 'Inchangés'
      17 : 'Doublons de code article'
      18 : 'Ayant un code court fixé'
      */
      let c = this.ifiltre
      let n = parseInt(this.argFiltre)
      if (isNaN(n)) { n = 0 }
      let p = this.argFiltre || ''
      let P = removeDiacritics(p.toUpperCase())
      let s = this.articles
      switch (c) {
        case 0 : { this.selArticles = s.filter(a => true); break }
        case 1 : { this.selArticles = s.filter(a => a.erreurs.length !== 0); break }
        case 2 : { this.selArticles = s.filter(a => a.bio); break }
        case 3 : { this.selArticles = s.filter(a => !a.bio); break }
        case 4 : { this.selArticles = s.filter(a => a.unite !== 'kg'); break }
        case 5 : { this.selArticles = s.filter(a => !a.unite === 'kg'); break }
        case 6 : { this.selArticles = s.filter(a => !a.image); break }
        case 7 : { this.selArticles = s.filter(a => a.imagel > n); break }
        case 8 : { this.selArticles = s.filter(a => a.id.startsWith(p)); break }
        case 9 : { this.selArticles = s.filter(a => a['code-barre'].startsWith(p)); break }
        case 10 : { this.selArticles = s.filter(a => a.codeCourt.startsWith(p.toUpperCase())); break }
        case 11 : { this.selArticles = s.filter(a => a.nomN.indexOf(P) !== -1); break }
        case 12 : { this.selArticles = s.filter(a => a.nomN.startsWith(P)); break }
        case 13 : { this.selArticles = s.filter(a => a.status === 1 || a.status === 4); break }
        case 14 : { this.selArticles = s.filter(a => a.status === 2); break }
        case 15 : { this.selArticles = s.filter(a => a.status >= 3); break }
        case 16 : { this.selArticles = s.filter(a => a.status === 0); break }
        case 17 : { this.selArticles = s.filter(a => this.fichier.mapId[a.id] > 1); break }
        case 18 : { this.selArticles = s.filter(a => a.nom.startsWith('[' + a.codeCourt + ']')) }
      }
      this.trier()
    },

    // l'aricle cliqué devient l'article courant : il est affiché par le composant ficheArticle. Arguments : index de l'article et position dans la sélection courante
    clicArticle (a, pos) {
      global.ficheArticle.ouvrir(a.n - 1, pos)
    },

    /*
    Ajout d'un nouvel article en queue de la liste : c'est ce qui permet de savoir qu'il a été créé.
    Des valeurs par défaut sont données à toutes les colonnes.
    L'article est décoré pour qu'il ait toutes propriétés calculées ET ses erreurs (par principe certaines propriétés par défaut ne sont pas acceptables).
    Les stats sont recalculés. On fait ensuite comme si on avait cliqué sur cet article qui a besoin d'être édité.
    */
    ajouterArticle () {
      let data = {}
      for (let i = 0, c = null; (c = colonnes[i]); i++) { data[c] = defVal[i] }
      this.articles.push(data)
      this.selArticles.push(data)
      data.n = this.articles.length
      decore(data)
      this.fichier.stats()
      this.clicArticle(data, this.selArticles.length - 1)
    },

    /*
    Cet événement est invoqué par ficheArticle quand un article a été édité et qu'on est passé au suivant / précédent ou sorti
    de ficheArticle, bref quand l'article est validé (a un nouveau contenu).
    Le recalcul de la sélection et de son tri est affectée par par le changement des valeurs de l'article.
    - si on recalcule toujours, on peut avoir un article qui peut sortir de la sélection et changer de place.
    Du coup la notion de "suivant" / "précédent" dans FicheArticle va être fausse.
    - on ne recalcule donc la sélection QUE quand on sort de FicheArticle.
    En contrepartie, l'article reste dans la sélection et à sa place initiale même si ça n'a plus lieu d'être
    ce qui est moins nocif que de risquer de faire sauter l'article de la sélection (qui à la limite aurait pu être vide).
    */
    dataChange (etFermer) {
      this.fichier.stats()
      if (etFermer) {
        this.filtrer()
        this.trier()
      }
    },

    // Sortie de la boîte de dialogue d'affichage d'une alerte
    erreur (msg, err) {
      this.texteAlerte = msg + (err ? '\n' + err : '')
      this.alerte = true
      this.panneauGauche = false
      this.modifie = false
    },

    // Sortie de la boîte de dialogue d'affichage d'une information
    information (msg) {
      this.texteAlerte = msg
      this.info = true
      this.panneauGauche = false
      this.modifie = false
    },

    /*
    Ouverture du menu. Les listes des archives en ligne et des modèles en ligne sont réévaluées.
    Elles pourraient avoir changé depuis la dernière fois.
    */
    ouvrirMenu () {
      this.lstArch = listeArchMod(true)
      this.lstMod = listeArchMod()
      this.panneauGauche = true
    },

    /*
    Ouverture de la boîte de dialogue demandant à l'utilisateur si on peut ouvrir un fichier
    bien que le courant n'ait pas été enregistré.
    La demande par principe est asynchrone : on se milite à enregistrer la fonction lambda resolve qui sera invoquée
    quand l'utilisateur donnera son avis. C'est la boîte de dialogue qui invoque ce resolve()
    */
    verifOuverture () {
      if (!this.fichier || !this.modifie) { return true }
      this.perdreModif = true
      return new Promise(resolve => {
        this.resolveFichier = resolve
      })
    },

    /*
    Ouverture d'un fichier.
    Il faut déjà que l'utilisateur accepte de ne pas enregistrer son fichier actuel au cas où il aurait des modifications.
    On ferme le panneau gauche "menu".
    - f : nom du fichier. nom du modèle, ou nom d'archive, ou £N (nouveau) ou $S (dsource du serveur ODOO)
    - arch : true si un fichier d'archive
    - source : pour ODOO la liste des articles (array d'objets directement), pour un fichier nouveau un array vide
    */
    async ouvrirFichier (f, arch, source) {
      this.chargement = true
      if (await this.verifOuverture()) {
        this.panneauGauche = false
        this.articles = []
        this.selArticles = []
        this.fichier = new Fichier(f, arch)
        try {
          this.articles = await this.fichier.lire(source)
          this.filtrer()
          this.chargement = false
        } catch (e) {
          this.fichier = null
          this.chargement = false
          this.erreur('Le fichier [' + f + '] est corrompu ou inaccessible.', e.message)
        }
      }
    },

    // Création du fichier et lecture d'une source d'articles vide
    async nouveauFichier () {
      await this.ouvrirFichier('$N', false, [])
    },

    /*
    L'import d'un fichier local consiste à le copier comme modèle, puis à l'ouvrir en tant que modèle
    */
    async importFichier (name, path) {
      if (await this.verifOuverture()) {
        if (!name.endsWith('.csv')) {
          this.erreur('Le fichier sélectionné doit être un ".csv".')
          return
        }
        try {
          await copieFichier(name, path)
          await this.ouvrirFichier(name)
        } catch (err) {
          this.erreur('Le fichier sélectionné n\'a pas pu être importé comme modèle.\n', err.message)
        }
      }
    },

    // Enregistrement en tant que modèle : invoqué par la boîte de dialogue de saisie du nom du modèle
    async enregModele () {
      let m = this.nomModele
      this.enreg = false
      try {
        this.nomModele = ''
        await this.fichier.ecrire(m)
      } catch (e) {
        this.erreur('Impossible d\'enregistrer le fichier [' + m + ']', e.message)
      }
    },

    // Mise en service du fichier courant. Ouverture de la boîte de dialogue de confirmation que le fichier devait être mis en service.
    envoyer () {
      this.fichier.stats()
      if (this.fichier.nberreurs) {
        this.texteAlerte = 'Corriger les erreurs dans le fichier avant de l\'envoyer aux balances'
        this.alerte = true
      } else {
        this.envoyerfichier = true
      }
    },

    /*
    Après confirmation de mise en service du fichier : écriture du fichier dans articles.csv et ouverture de la boîte de dialogue d'information
    Si la date-heure d'archivage qui revient est null, c'est que le fichier actuellement en service est exactement le même et n'a pas été
    ni ré-écrit sur articles.csv, ni mis en archive
    */
    async envoyer2 () {
      this.dhArchivage = await this.fichier.ecrire(null, true)
      this.envoye = true
    },

    // Destruction d'un modèle, ouverture du fichier actuellement en service
    async detruire () {
      this.fichier.detruire()
      await this.ouvrirFichier()
    }
   }
}
</script>

<style lang="sass">
@import './css/app.sass'
.btnfermer
  position: absolute
  z-index: 10
  top: 0

.btnfermerg
  right: - (1 * $largeFontSize)

.status
  font-size: $standardFontSize

.menuText
  font-size: $largeFontSize
  color: black

.modeleDialog
  width: 50%
  min-width: 400px

.menuButton
  font-size: $veryLargeFontSize !important
  color: $primary

.zoneErr
  height: 3rem
  color: black

.negative
  color: $negative !important

.pasArticles
  text-align: center
  font-style: italic
  font-size: $veryLargeFontSize

.titre1
  font-size: $largeFontSize
  font-weight: bold
  font-style: italic
  text-align: right
  margin: 0.5rem 0.5rem 0 0

.artErr
  background-color: white
  color: red
  font-weight: bold

.fichier
  font-size: $standardFontSize
  text-align: left
  margin: 0 0.5rem
  color: $blue-10
  text-decoration: underline
  cursor: pointer

.fichier:hover
  background-color: $blue-2

.nomModeleOK
  font-weight: normal
  font-size: $smallFontSize

.nomModeleKO
  font-weight: bold
  color: red
  font-size: $standardFontSize

.dialogText
  font-size: $largeFontSize

</style>
