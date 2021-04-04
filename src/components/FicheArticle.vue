<!--
FicheArticle est un dialogue modal qui permet d'éditer un article, de changer les valeurs de ses champs
et de vérifier leurs validités.
A tout instant la liste des errueurs en cours s'affiche en haut en synthèse en plus de l'affichage
sur la plupart des champs en saisie.
La fiche permet aussi de navigueur d'un article à l'autre selon la liste courante de App.vue
Actions d'édition :
- rétablir l'état de l'article à celui INITIAL qu'il avait, celui qui est actuellement sur disque.
- rétablir l'état de l'article au moment de son entrée dans ce dialogue
- supprimer un article
- faire renaître un article supprimé dans son état avant suppression
Tout ceci selon le statut d'édition de l'article.
-->
<template>
<div>
  <q-dialog v-model="ficheArticle" full-width persistent>
  <q-layout view="Lhh lpR fff" container class="bg-white">
    <q-header class="bg-grey-9 column">
      <!-- Toolbar toujours visible en haut : permet de naviguer à l'article suivant / précédent,
      de valider les modifications en cours et de fermer le dialogue-->
      <q-toolbar class="col-auto q-py-md">
        <q-btn :disable="pos === 0" round color="primary" icon="skip_previous" @click="precedent()"/>
        <div class="q-px-md">{{ (pos + 1) }} / {{ max }}</div>
        <q-btn :disable="pos === max - 1" round color="primary" icon="skip_next" @click="suivant()"/>
        <q-toolbar-title>Article #{{data.n}} - [{{data.codeCourt}}] Code:{{data.id}}</q-toolbar-title>
          <q-btn v-if="estmodifie" dense icon-right="done" color="primary" @click="validerEtFermer()">Valider et fermer</q-btn>
          <q-btn v-else dense icon-right="close" color="primary" label="Fermer" @click="fermer()"/>
      </q-toolbar>

      <!-- Seconde toolbar en dessous, toujours visible aussi, d'édition :
      statut d'édition de l'article, undo / redo / suppression -->
      <div style="margin: 0 0.5rem">
      <div class="col-auto row justify-between items-center">
        <div :class="(this.data.status ? 'text-deep-orange text-h4' : 'text-h5')">{{labelStatus[this.data.status]}}</div>
        <div class="col-auto row q-gutter-sm">
          <q-btn class="col-auto" :disable="!estmodifie" icon="undo" color="deep-orange" @click="annuler()">Annuler tous<br>les changements</q-btn>
          <q-btn class="col-auto" :disable="!pasinitial" icon="replay" color="deep-orange" @click="retablir()">Rétablir<br>l'état initial</q-btn>
          <q-btn v-if="this.data.status < 4" class="col-auto" icon="undo" color="deep-orange" @click="supprimer()">Supprimer<br>l'article</q-btn>
          <q-btn v-else icon="redo" class="col-auto" color="deep-orange" @click="reactiver()">Ré-activer<br>l'article</q-btn>
        </div>
      </div>
      </div>

      <!-- Liste des erreurs de l'article -->
      <q-scroll-area class="erreurs">
        <div v-for="e in erreurs" :key="e" class="q-py-sm">{{ e }}</div>
      </q-scroll-area>
    </q-header>

    <!-- Zone d'édition des champs de l'article
    Pour tous les q-input il FAUT les propriétés :
    :erreur - expression disant si le champ est en erreur ou non
    :erreur-message - expression retournant le message d'erreur
    @input - déclenchée à chaque data entry, en général verif('ciode-du-champ')
    Des boutons permettent : undo() et reinit()
    -->
    <q-page-container>
      <div class="column justify-start">
        <!-- Id de l'article : numérique -->
        <q-input class="shadow-5 input1" color="black" bottom-slots :error="erMap.id ? true : false" :error-message="erMap.id" v-model="data.id" clearable label="Code article de 1 à 6 chiffres" @input="verif('id')">
          <template v-slot:append>
            <q-btn round size="xs" color="deep-orange" icon="undo" :disable="data.id === dataAV.id" @click="undo('id')"/>
            <q-btn round size="xs" color="deep-orange" icon="replay" :disable="!dataI || data.id === dataI.id" @click="reinit('id')"/>
          </template>
        </q-input>

        <!-- Nom de l'article -->
        <q-input class="shadow-5 input1" color="black" bottom-slots :error="erMap.no ? true : false" :error-message="erMap.no" v-model="data.nom" clearable label="Nom" @input="verif('nom')">
          <template v-slot:append>
            <q-btn round size="xs" color="deep-orange" icon="undo" :disable="data.nom === dataAV.nom" @click="undo('nom')"/>
            <q-btn round size="xs" color="deep-orange" icon="replay" :disable="!dataI || data.nom === dataI.nom" @click="reinit('nom')"/>
          </template>
        </q-input>

        <!-- Code-barre de l'article -->
        <q-input class="shadow-5 input1" color="black" bottom-slots :error="erMap.co ? true : false" :error-message="erMap.co" v-model="data['code-barre']" clearable label="Code barre à 13 chiffres)" @input="verif('code-barre')">
          <template v-slot:append>
            <q-btn round size="xs" color="deep-orange" icon="undo" :disable="data['code-barre'] === dataAV['code-barre']" @click="undo('code-barre')"/>
            <q-btn round size="xs" color="deep-orange" icon="replay" :disable="!dataI || data['code-barre'] === dataI['code-barre']" @click="reinit('code-barre')"/>
          </template>
        </q-input>

        <!-- Prix de l'article -->
        <q-input class="shadow-5 input1" color="black" bottom-slots :error="erMap.pr ? true : false" :error-message="erMap.pr" v-model="data.prixS" clearable @input="verif('prixS')"
          :label="'Saisir le prix en centimes ==> ' + (data.prixS !== '0' ? data.prix : '0') + '€'">
          <template v-slot:append>
            <q-btn round size="xs" color="deep-orange" icon="undo" :disable="data.prix === dataAV.prix" @click="undo('prix')"/>
            <q-btn round size="xs" color="deep-orange" icon="replay" :disable="!dataI || data.prix === dataI.prix" @click="reinit('prix')"/>
          </template>
        </q-input>

        <!-- Catégorie de l'article (courte liste fermée) -->
        <q-input class="q-gutter-sm shadow-5 input1" v-model="data.categorie" label="Catégorie" />

        <!-- Unité(s) ou kg -->
        <div class="q-gutter-sm shadow-5 input1">
          <q-radio v-model="data.unite" val="kg" label="au Kg" />
          <q-radio v-model="data.unite" val="Unite(s)" label="à l'unité" />
        </div>

        <!-- Affichage de l'image -->
        <div class="q-gutter-sm shadow-5 input1 column q-gutter-sm items-center">
          <div v-if="data.image ? true : false">
            <img class="col-auto image2" :src="'data:image/jpeg;base64,' + data.image"/>
            <div class="col-auto">{{ data.imagel + 'x' + data.imageh }}</div>
          </div>
          <div v-else>Pas d'image</div>
          <!-- Bouton d'ouverture d'un dialogue pour saisie d'une nouvelle image -->
          <q-btn class="col-auto" size="md" color="deep-orange" label="Autre image depuis un fichier" @click="nouvelleImage = true"/>
        </div>
      </div>
    </q-page-container>
  </q-layout>
  </q-dialog>

  <!-- Dialogue de sélection d'un nouveau fichier image. Mais l'image choisie peut ne pas être carrée de 128x128. Il y a alors deux choix possibles :
  - retailler l'image pour qu'elle couvre toute la surface (en en perdant des morceaux sur les côtés ou en haut et en bas)
  - garder toute l'image et la centrer avec das bandes sur les côtés ou en haut et en bas.
  On peut aussi renoncer à cette nouvelle image.
  -->
  <q-dialog v-model="nouvelleImage" class="bg-white" persistent>
    <q-card>
      <q-card-section class="row items-center">
          <q-file class="col-auto" v-model="imageLocale" label="Choisir un fichier jpeg" style="width:20rem;"/>
      </q-card-section>
      <q-card-actions class="column items-end no-wrap">
          <q-btn class="col-auto" v-close-popup flat size="md" color="primary" label="Couvrante : coupée en haut/bas ou à gauche/droite"
            :disable="img == null" @click="resize('cover')"/>
          <q-btn class="col-auto" v-close-popup flat size="md" color="primary" label="Centrée : marge noire en haut/bas ou à gauche/droite"
            :disable="img == null" @click="resize('content')"/>
          <q-btn class="col-auto" flat label="Je renonce" color="negative" v-close-popup @click="nouvelleImage = false"/>
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Dialogue invoqué en cas de sortie de l'édition (par exemple passage au précédent / suivant) et demandant si l'utilisateur perd ou garde ses modifications -->
  <q-dialog v-model="perdreModif" persistent>
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="block" color="negative" text-color="white"/>
        <span class="q-ml-sm dialogText">Cet article a été modifié. Voulez-vous vraiment perdre les changements ?</span>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Non, je les valide" color="primary" v-close-popup
          @click="perdreModif = false;resolve(false)"/>
        <q-btn flat label="Oui, je les perd" color="negative" v-close-popup
          @click="perdreModif = false;resolve(true)"/>
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Dialogue invoqué en cas de sortie de l'édition (par exemple passage au précédent / suivant) et que l'article a des erreurs.
  Les laisser ou rester sur l'article pour le corriger -->
  <q-dialog v-model="fermerqm" persistent>
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="block" color="negative" text-color="white"/>
        <span class="q-ml-sm dialogText">Cet article comporte au moins une erreur. Voulez-vous vraiment le valider et fermer ?</span>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat size="md" label="Non, je le laisse ouvert pour corriger" color="primary" v-close-popup
          @click="fermerqm = false;resolve(false)"/>
        <q-btn flat size="md" label="Oui, je ferme quand-même" color="negative" v-close-popup
          @click="fermerqm = false;resolve(true)"/>
      </q-card-actions>
    </q-card>
  </q-dialog>

</div>
</template>

<script>
/* Extrait de l'API Jimp utilisé :
data.img.getBase64Async(mime); // Returns Promise
Jimp.MIME_JPEG; // "image/jpeg"
image.contain( w, h[, alignBits || mode, mode] );    // scale the image to the given width and height, some parts of the image may be letter boxed
image.cover( w, h[, alignBits || mode, mode] );      // scale the image to the given width and height, some parts of the image may be clipped
fs.readSyncFile('/etc/passwd', { encoding: 'base64' })
*/

import { clone, eq, colonnes, defVal, decore, maj } from '../app/fichier'
import { global } from '../app/global'

const fs = require('fs')
const Jimp = require('jimp')

// valeurs par défaut d'un article
const defValObj = {}
for (let i = 0, c = null; (c = colonnes[i]); i++) { defValObj[c] = defVal[i] }

export default {
  name: 'FicheArticle',
  mounted() {
    global.ficheArticle = this // Enregistrement de ce composant en global
  },
  data () {
    return {
      /* Les initulés des statuts 0 1 2 3 4 */
      labelStatus: ['inchangé', 'créé', 'modifié', 'supprimé', 'créé puis supprimé'],
      fichier: null, // Objet fichier dont l'article fait partie
      max: 0, // nombre d'articles dans la sélection filtrée de App.vue. Avec pos, permlet de savoir si l'article est le dernier ou non (suivant possible ou non)
      ficheArticle: false, // model pilotant l'ouverture de la ficheArticle elle-même
      fermerqm: false, // model pilotant la boîte de dialogue "Fermer quand-même malgré la présence d'erreurs"
      perdreModif: false, // model pilotant la boîte de dialogue "Perdre les éditions faites ou les valider"
      nouvelleImage: false, // model pilotant la boîte de dialogue de mande d'un nouveau fichier image
      idx: 0, // index de l'article dans son fichier
      pos: 0, // position de l'article dans la sélection courante dans App.vue (qui peut être filtrée / triée)
      data: {}, // propriétés courantes de l'article
      dataAV: {}, // propriétés courantes de larticle à son entrée dans ce dialogue, AVANT modificiation (undo possible ou non)
      dataI: {}, // propriétés de l'article dans son état INITIAL, tel qu'il est sur disque avant toute édition (permet de le rétablir)
      n: 0,
      imageLocale: null, // objet "file" de sélection sur un input"
      img: null,
      erreurs: [], // liste des erreurs. Chaque erreur commence par le nom de la propriété correspondante
      erMap: {} // pour les deux premières lettres d'un code de champ, texte de l'erreur éventuelle (le champ est-il en erreur, et laquelle)
    }
  },

  computed: {
    /* détermine si un article a été modifié, bref si son état actuel diffère de son état au début de l'affichage par la fiche */
    estmodifie () {
      let b = this.data.nom !== this.dataAV.nom ||
        this.data.id !== this.dataAV.id ||
        this.data['code-barre'] !== this.dataAV['code-barre'] ||
        this.data.prix !== this.dataAV.prix ||
        this.data.categorie !== this.dataAV.categorie ||
        this.data.unite !== this.dataAV.unite ||
        this.data.image !== this.dataAV.image
      return b
    },

    /* l'aricle est-il identique à son état initial, (celui sur disque) avant toute édition */
    pasinitial () {
      let b = this.dataI && (
        this.data.nom !== this.dataI.nom ||
        this.data.id !== this.dataI.id ||
        this.data['code-barre'] !== this.dataI['code-barre'] ||
        this.data.prix !== this.dataI.prix ||
        this.data.categorie !== this.dataI.categorie ||
        this.data.unite !== this.dataI.unite ||
        this.data.image !== this.dataI.image
      )
      return b
    }
  },

  watch: {
    /* En cas de changement d'image, traitement du fichier correspondant */
    imageLocale(file) {
      if (file) {
        this.imageLocale = null
        this.chargeImage(file.path)
      }
    }
  },

  methods: {
    /* Chaque vérification d'un champ risque de créer ou de supprimer le diagnostic d'erreur relatif à ce champ.
    Suppression des erreurs liées au champ c et donnée de la nouvelle erreur (s'il y a lieu).
    Met à jour à la fois la propriété erreurs et erMap */
    filtreErr (c, err) {
      this.erMap = {}
      this.erreurs = []
      let v = this.data.erreurs
      for (let i = 0, e = null; (e = v[i]); i++) {
        if (!e.startsWith(c)) {
          this.erreurs.push(e)
          this.erMap[c] = e
        }
      }
      if (err) {
        this.erreurs.push(err)
        this.erMap[c] = err
      }
      this.data.erreurs = this.erreurs
    },

    // undo de la valeur d'une propriété : restaure celle AVANT
    async undo (c) {
      this.data[c] = this.dataAV[c]
      await this.verif(c)
    },

    // rétablissement de la valeur d'un champ à sa valeur initiale (sauvée sur disque), avant toute édition
    async reinit (c) {
      if (this.dataI) {
        this.data[c] = this.dataI[c]
        await this.verif(c)
      }
    },

    /* Vérification de la validité du champ c : calcul son erreur et la garde dans erreurs et erMap
    La vérification pour une image peut être longue, Jimp est asynchrone, ce qui rend la fonction async */
    async verif (c) {
      let err
      if (!this.data[c]) this.data[c] = ''
      if (c === 'prixS') {
        if (!this.data.prixS) this.data.prixS = '0'
        err = await maj(this.data, 'prix', this.data.prixS, true)
      } else {
        err = await maj(this.data, c, this.data[c], true)
      }
      this.filtreErr(c.substring(0, 2), err)
      this.setStatus()
      return err || ''
    },

    /*
    Ouverture de la fiche article pour un article donné invoquée par App.vue quand on clique sur l'article
    - fichier est celui courant ouvert par App.vue.
    - idx est l'index de l'article dans la liste des articles du fichier
    - pos : App.vue affiche une sélection triée d'articles. pos est la position de l'article dans cette sélection courante
    */
    async ouvrir (idx, pos) {
      this.fichier = global.appVue.fichier
      this.max = global.appVue.selArticles.length
      this.idx = idx
      this.pos = pos
      this.data = this.fichier.articles[this.idx] // les propriétés courantes de l'article
      this.dataAV = clone(this.data) // les valeurs AVANT édition
      /* les valeurs de l'état initial.
      MAIS on a pu créer des articles, toujours en queue, donc il n'y a pas toujours d'état INITIAL */
      this.dataI = this.idx < this.fichier.articlesI.length ? this.fichier.articlesI[this.idx] : null
      this.ficheArticle = true // affichage de la fiche article
    },

    /* fermeture : réinitialisation des positions */
    fermer () {
      this.idx = 0
      this.pos = 0
      this.data = {}
      this.dataAV = {}
      this.dataI = {}
      this.ficheArticle = false
    },

    /* retaillage d'une image, soit en "cover" (découpe éventuelle), soit en "contain" (bandes ajoutées éventuellement */
    resize(option) {
      if (!this.img) { return }
      let x = 'data:image/jpeg;base64,'
      try {
        this.img = option === 'cover' ? this.img.cover(128, 128) : this.img.contain(128, 128) // retaillage
        this.img.getBase64Async('image/jpeg')
        .then(b64 => {
          this.data.image = b64.substring(x.length)
          this.data.imagel = this.img.bitmap.width
          this.data.imageh = this.img.bitmap.height
          this.img = null
          this.filtreErr('im')
        }).catch(err => {
          this.img = null
          this.filtreErr('im', 'image non affichable (1) : ' + err.message)
        })
      } catch (err) {
        this.img = null
        this.filtreErr('im', 'image non affichable (2) : ' + err.message)
      }
    },

    /* Chargement du binaire d'une image sur disque depuis son path */
    async chargeImage(path) {
      this.img = null
      try {
        let b64 = fs.readFileSync(path, { encoding: 'base64' })
        let buffer = Buffer.from(b64, 'base64')
        this.img = await Jimp.read(buffer) // Construction en tant qu'image par Jimp : échoue si ça n'est pas une image
        this.filtreErr('im')
      } catch (err) {
        this.filtreErr('im', 'image non affichable : ' + err.message)
      }
    },

    /* Demande confirmation / infirmation de sortir alors qu'il reste des erreurs : le "resolve" sera invoqué lors du clic sur le bouton de confirmation */
    fermerQuandMeme () {
      this.fermerqm = true
      return new Promise(resolve => {
        this.resolve = resolve
      })
    },

    /* Demande confirmation / infirmation de perdre les éditions de l'article : le "resolve" sera invoqué lors du clic sur le bouton de confirmation */
    perdreValidation () {
      if (!this.estmodifie) { return true }
      this.perdreModif = true
      return new Promise(resolve => {
        this.resolve = resolve
      })
    },

    /* Passage à l'article précédent : s'assure que l'utilisateur accepte de perdre ses éditions s'il y en a eu
    Selon le cas "annule" les éditions ou les "valide" */
    async precedent () {
      if (this.pos === 0) { return }
      this.pos-- // nouvelle position dans la sélection affichée dans App.vue
      if (this.estmodifie) {
        if (await this.perdreValidation()) {
          this.annuler()
        } else {
          this.valider()
        }
      }
      this.idx = global.appVue.selArticles[this.pos].n - 1 // idx de l'article suivant
      this.ouvrir(this.idx, this.pos) // ouverture de la fichae article
    },

    /* Passage à l'article suivant : s'assure que l'utilisateur accepte de perdre ses éditions s'il y en a eu
    Selon le cas "annule" les éditions ou les "valide" */
    async suivant () {
      if (this.pos === this.max - 1) { return }
      this.pos++ // nouvelle position dans la sélection affichée dans App.vue
      if (this.estmodifie) {
        if (await this.perdreValidation()) {
          this.annuler()
        } else {
          this.valider()
        }
      }
      this.idx = global.appVue.selArticles[this.pos].n - 1 // idx de l'article suivant
      this.ouvrir(this.idx, this.pos) // ouverture de la fichae article
    },

    /* suppression de l'article : consiste seulement en son changement de status
    (qui passe à 3 ou 4 selon que l'article existait ou a tété créé */
    supprimer () {
      this.data.status = this.data.status === 1 ? 4 : 3
    },

    /* réactivation ("dé-suppression" d'un article supprimé). Rétablit son statut antérieur */
    reactiver () {
      this.data.status = this.idx >= this.fichier.articlesI.length ? 1 : (eq(this.data, this.dataI) ? 0 : 2)
    },

    /* recalcul le statut d'un article, selon :
    -qu'il a été créé ou non
    -qu'il a été édité depuis son état initial ou non
    */
    setStatus () {
      const cr = this.idx >= this.fichier.articlesI.length
      if (cr) {
        this.data.status = eq(this.data, defValObj) ? 4 : 1
      } else {
        this.data.status = eq(this.data, this.dataI) ? 0 : 2
      }
    },

    /* validation des éditions de l'article : ses champs calculés le sont, son status est évalué, ET App.vue EST NOTIFIE */
    async valider (etFermer) {
      this.setStatus()
      await decore(this.data)
      global.appVue.dataChange(etFermer)
    },

    /* annulation des éditions de l'article : ses champs sont remis à la valeur AVANT puis il est validé */
    annuler () {
      for (let i = 0, f = null; (f = colonnes[i]); i++) { this.data[f] = this.dataAV[f] }
      this.valider()
    },

    /* rétablissement de l'état INITIAL des éditions de l'article : ses champs sont remis à la valeur INITIALE puis il est validé */
    retablir () {
      const cr = this.idx >= this.fichier.articlesI.length
      // la source des valeurs est soit l'image initiale de l'article, soit les valeurs par défaut pour une création
      const src = !cr ? this.fichier.articlesI[this.idx] : defValObj
      for (let i = 0, f = null; (f = colonnes[i]); i++) { this.data[f] = src[f] }
      this.valider()
    },

    /* Validation de l'article ET fermeture de fiche article : si l'article a des erreurs, deamnde confirmation */
    async validerEtFermer() {
      if (this.data.erreurs.length !== 0 && !(await this.fermerQuandMeme())) { return }
      this.valider(true)
      this.ficheArticle = false
    }

  }
}
</script>

<style lang="sass">
@import '../css/app.sass'

.titre
  font-size: $largeFontSize
  text-align: left
  padding: 1rem 0
  font-weight: bold

.erreurs
  height: 5rem
  background-color: $grey-3
  color: $deep-orange
  margin: 0.5rem
  padding: 0.5rem

.dialogText
  font-size: $largeFontSize

.input1
  margin: 0.5rem
  padding: 0rem 0.5rem 2rem 0.5rem
  color: black
  font-size: $largeFontSize

.btnimg
  max-width: 8rem !important

.image2
  border: 2px solid black
  background: repeating-linear-gradient(to right, #f6ba52, #f6ba52 10px, #ffd180 10px, #ffd180 20px)
  width: 128px

</style>

