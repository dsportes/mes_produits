/*
Module gérant les fichiers descriptifs des articles qui sont des CSV ayant les colonnes suivantes :
    id nom code-barre prix categorie unite image
Un fichier est chargé en mémloire dans une liste 'articles' :
- c'est de facto l'index dans la liste qui y est identifiant (PAS id, doublons possibles)
- chaque objet de la liste, nommé article ou data la plupart du temps contient des propriétés supplémentaires
calculées depuis la ligne du fichier CSV:
    n : numéro de ligne dans le fichier (identifiant)
    nomN : nom normalisé, en majuscule et sans accent
    err[] : liste des erreurs détectées
    codeCourt : deux lettres en majuscules calculées depuis l'id ou donné explicitement en tête du nom
    unite : kg si le produit est à peser
    bio : true si le mot BIO figure dans le nom (non case sensitive)
    prixN : prix sous forme numérique
    imagel : largeur de l'image
    imageh : hauteur de l'image
    status : statut d'édition : 0:inchangé, 1:créé, 2:modifié, 3:détruit, 4:créé puis détruit
*/

import { config } from './config'
import { removeDiacritics, editEAN, formatPrix, dateHeure, centimes, nChiffres, codeCourtDeId } from './global'
const csv = require('csv-parser')
const fs = require('fs-extra')
const path = require('path')

const createCsvStringifier = require('csv-writer').createObjectCsvStringifier
const Jimp = require('jimp')

// liste des colonnes du fichier CSV
export const colonnes = ['id', 'nom', 'code-barre', 'prix', 'categorie', 'unite', 'image']

// valeurs par défaut de ces colonnes quand on crée un article vide
export const defVal = ['99999', '', '0000000000000', '0.0', 'A', 'Unite(s)', '']

// les mêmes directement en CSV
export const ligne1 = '99999;"";0000000000000;0.0;A;Unite(s);""\n'

// l'entête CSV depuis les noms des colonnes
let enteteCSV = []
for (let i = 0, f = null; (f = colonnes[i]); i++) { enteteCSV.push('"' + f + (i === colonnes.length - 1 ? '"\n' : '";')) }
enteteCSV = enteteCSV.join('')

// directory racine
const dir = config.dir

// directory contenant les archives des derniers fichiers mis à disposition des balances
const archivesPath = path.join(dir, 'archives')

// directory contenant des modèles de fichiers
const modelesPath = path.join(dir, 'modèles')

// nom du fichier de référence articles.csv mis à disposition des balances
const articlesPath = path.join(dir, 'articles.csv')

// nombre maximal de fichiers gardés en archives
const maxArch = config.nbMaxArchives ? config.nbMaxArchives : 10

// constante nécessaire pour l'écriture de fichiers CSV depuis une liste d'objets
const header = [
    { id: 'id', title: 'id' },
    { id: 'nom', title: 'nom' },
    { id: 'code-barre', title: 'code-barre' },
    { id: 'prix', title: 'prix' },
    { id: 'categorie', title: 'categorie' },
    { id: 'unite', title: 'unite' },
    { id: 'image', title: 'image' }
]

export function checkDirs() {
    try {
        fs.ensureDirSync(archivesPath)
        fs.ensureDirSync(modelesPath)
        return null
    } catch (e) {
        return e.message
    }
}

// liste des articles actuellement mis à disposition des bamlances. Change à chaque mise en service explicite
let reference = []

// clone un article, en fait seulement ses données CSV, pas celles calculées et ajoutées
export function clone(data) {
    const a1 = {}
    for (let i = 0, f = null; (f = colonnes[i]); i++) { a1[f] = data[f] }
    return a1
}

// détermine si deux articles sont identiques, ont les mêmes valeurs pour les colonnes du CSV
export function eq(a1, a2) {
    for (let i = 0, f = null; (f = colonnes[i]); i++) { if (a1[f] !== a2[f]) { return false } }
    return true
}

// détermine si une liste d'articles est exactement identique à celle actuellement mise à disposition des balances
export function eqRef(articles) {
    if (articles.length !== reference.length) { return false }
    for (let i = 0; i < articles.length; i++) {
        if (!eq(reference[i], articles[i])) { return false }
    }
    return true
}

// liste les archives actuellement disponibles dans le répertoire ./archives
export function listeArchMod(arch) {
    let lst = []
    fs.readdirSync(arch ? archivesPath : modelesPath).forEach(file => {
        if (file.endsWith('.csv')) { lst.push(file) }
    })
    lst.sort((a, b) => a > b ? 1 : (a < b ? -1 : 0))
    if (arch && lst.length > maxArch) {
        for (let i = maxArch - 1; i < lst.length; i++) {
            fs.unlinkSync(path.join(archivesPath, lst[i]))
        }
        lst.splice(maxArch, lst.length - maxArch)
    }
    return lst
}

/*
Copie un fichier de path p quelconque sous ./modèles avec un nom donné
La raison d'un Promise n'est pas claire puisqu'on utilise que des fs "sync". Peut-être historique, mais bon ça marche
*/
export function copieFichier(nom, p) {
    return new Promise((resolve, reject) => {
        const data = fs.readFileSync(p, 'utf8', (err) => { reject(err) })
        fs.writeFileSync(path.join(modelesPath, nom), data, (err) => { reject(err) })
        resolve()
    })
}

/*
Une instance de Fichier représente un fichier CSV chargé en mémoire.
Le constructeur (nom, arch) donne son origine :
    Si nom est présent et ne commence pas par $ : c'est soit une archive, soit un modèle
    Si nom == '$S' : fichier récupéré du serveur central (sélection d'articles de ODOO).
    Si nom == '$N' : c'est un nouveau fichier vide.
    Si nom est absent : c'est le fichier actuellement mis à disposition des balances
*/
export class Fichier {
    constructor (nom, arch) {
        this.nom = nom && nom.endsWith('.csv') ? nom.substring(0, nom.length - 4) : nom
        this.arch = arch
        if (this.nom) {
            if (this.nom === '$S') {
                this.label = 'Fichier importé du central'
            } else if (this.nom === '$N') {
                this.label = 'Fichier nouveau'
            } else if (arch) {
                this.label = 'Archive [' + nom + ']'
                this.path = path.join(archivesPath, this.nom + '.csv')
            } else {
                this.label = 'Modèle [' + nom + ']'
                this.path = path.join(modelesPath, this.nom + '.csv')
            }
        } else {
            this.path = articlesPath
            this.label = 'Fichier en service'
        }
        this.articles = []
        this.articlesI = []
        this.nbcrees = 0
        this.nbmodifies = 0
        this.nbsupprimes = 0
        this.nberreurs = 0
    }

    // destruction physique du fichier (purge)
    detruire () {
        if (this.nom) { fs.unlinkSync(this.path) }
    }

    /*
    Ecriture / sauvegarde d'un fichier :
        1) Si n est présent, le sauver en tant que modèle sous le nom n
        2) Si envoi est true, le mettre à disposition des balances, à moins que son contenu soit strictement identique
            à celui déjà mis à disposition, et donc ne pas l'archiver puisqu'il est inchangé.
            si différent de la référence : écrityre en archive ET sur articles.csv
    */
    ecrire (n, envoi) {
        let na = []
        /*
        Le fichier a été modifié en mémoire. Il y figure :
        - des aricles qui ont été marqués "supprimés" : ils ne se retrouvent pas dans le fichier sauvé
        - des articles créés ou modifiés qui deviennent des articles normaux (status 0)
        - na  : c'est la nouvelle image du fichier après sauvegarde
        */
        for (let i = 0; i < this.articles.length; i++) {
            let x = this.articles[i]
            if (x.status <= 2) {
                na.push(x)
                x.status = 0
            }
        }
        this.articles = na
        this.stats() // on recalcule les stats, en particulier puisque les articles ont changé de status
        let aEnvoyer = envoi && !eqRef(na) // le fichier est à mettre à disposition des balances, SI c'est deamndé en paramètre ET SI ça change de la référence (le dernier mis à disposition)
        if (!n && !aEnvoyer) return null // c'est le fichier actuellement en service ET il est inchangé : on ne sauve rien
        return new Promise((resolve, reject) => {
            const csvStringifier = createCsvStringifier({ header: header, fieldDelimiter: ';' })
            const s = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(na)
            let a
            if (this.nom && !this.arch && !n) {
                // c'est un modele à sauver en son nom
                fs.writeFileSync(path.join(modelesPath, this.nom + '.csv'), s, (err) => { reject(err) })
            }
            if (n) {
                // c'est n'importe quoi à sauver comme modèle
                this.nom = n // désormais si c'était un fichier nouveau, c'est devenu un modèle nommé
                this.arch = false
                this.label = 'Modèle [' + this.nom + ']'
                this.path = path.join(modelesPath, this.nom + '.csv')
                fs.writeFileSync(this.path, s, (err) => { reject(err) })
            }
            if (aEnvoyer) {
                // le contenu diffère de celui mis à disposition des balances : le sauver mettre en archives ET dans aricles.csv. C'est la nouvelle référence
                a = dateHeure()
                fs.writeFileSync(articlesPath, s, (err) => { reject(err) })
                fs.writeFileSync(path.join(archivesPath, a + '.csv'), s, (err) => { reject(err) })
                reference = [] // ça devient la nouvelle réfrence. On clone les articles parce que le fichier courant peut ensuite être édité
                for (let i = 0, data = null; (data = this.articles[i]); i++) reference.push(clone(data))
            }
            resolve(a) // date-heure d'archivage; null si n'a pas été copié dans articles.csv / archive
        })
    }

    /*
    Lecture d'un fichier CSV :
    Si le fichier a pour nom $S l'argument source est l'array des articles (objets) importée des données du serveur central (ODOO).
    Si le fichier est $N la source est un array vide
    Sinon le contenu est lu depuis le fichier dont le path a été défini au constructor (nom arch) ou n'a pas de nom (articles.csv).
    Un fichier importé est copié comme modèle avant ouverture en tant que modèle.
    Propriétés :
        articles : array des articles dans leur état courant (potenteiellement modifiés, créés, détruits)
        articlesI : array des articles dans leur état initial, clonés à la lecture, pour savoir pour chaque article quel étatit son état avant édition
        --- Calculées par stats()
        nbcrees : nombre d'articles créés
        mapId : map pour chaque id, nombre d'articles ayant cette id. Un doublon d'id dans le fichier est possible mais grave
        nbmodifies : nombre d'articles modifiés
        nbsupprimes : nombre d'articles supprimés
        nberreurs : nombre d'articles ayant au moins une erreur= 0
        doublons : liste des index des articles en doublon d'id
    */
    async lire (source) {
        if (this.nom && this.nom.startsWith('$')) {
            // Synchrone : pas de lecture de fichiers
            this.articles = []
            this.articlesI = []
            let n = 0
            for (let i = 0, data = null; (data = source[i]); i++) {
                // Chaque article est numéroté et décoré (ajout de propriétés calculées)
                n++
                data.n = n
                data.status = 0
                await decore(data)
                this.articlesI.push(clone(data)) // cloné dans articlesI pour avoir son état avant édition éventuelle
                this.articles.push(data)
            }
            this.stats() // recalcul des statistiques sur le fichier
            return this.articles
        }

        // Asynchrone : il y a lecture de fichier et parse CSV
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(this.path)
            let n = 0 // compteur d'article lu / parsé
            this.erreur = false // pas trouvé d'erreur à la lecture / parse
            let ref = [] // deviendra (ou non) la future réfrence
            stream.on('error', (e) => {
                reject(e)
            })
            try {
                stream.pipe(csv({ separator: ';' }))
                .on('data', (data) => {
                    /*
                    Pour chaque article, préparé ou non pour être mis en référence, décompté, status à 0
                    et conservé dans articles (à éditer) et articlesI (état initial avant édition)
                    */
                    n++
                    data.n = n
                    data.status = 0
                    if (!this.nom) ref.push(clone(data))
                    this.articles.push(data)
                    this.articlesI.push(clone(data))
                })
                .on('end', async () => {
                    /*
                    Tous lus :
                    - on décore tous les articles : recherche d'erreurs, ajout de propriétés
                    - on calcule la statistique globale
                    Le await decore() est fait "on end" et a posé des problèmes quand il était fait dans "on data" (qui ne sembalit pas accepter le async (?)
                    */
                    if (!this.nom) reference = ref
                    for (let i = 0, data = null; (data = this.articles[i]); i++) {
                        await decore(data)
                    }
                    this.stats()
                    resolve(this.articles) // pas vraiment utile de renvoyer articles, mais bon...
                })
                stream.on('error', (e) => {
                    reject(e)
                })
            } catch (e) {
                reject(e)
            }
        })
    }

    /*
    Calcul des propriétés statistiques du fichier, de ses éditions
    */
    stats () {
        this.nbcrees = 0
        this.mapId = {}
        this.nbmodifies = 0
        this.nbsupprimes = 0
        this.nberreurs = 0
        this.doublons = []
        for (let i = 0; i < this.articles.length; i++) {
            let a = this.articles[i]
            if (a.erreurs.length) { this.nberreurs++ }
            if (a.status === 1 || a.status === 4) { this.nbcrees++ }
            if (a.status === 2) { this.nbmodifies++ }
            if (a.status === 3 || a.status === 4) { this.nbsupprimes++ }
            let e = this.mapId[a.id]
            if (!e) {
                this.mapId[a.id] = 1
            } else {
                if (e === 1) {
                    this.doublons.push(a.id)
                }
                this.mapId[a.id] = e + 1
            }
        }
    }
}

/*
Cette fonction calcule les propriétés calculées d'un article (data) et accumule
dans erreurs les diagnostics d'erreurs rencontrées.
Cette fonction est invoquée :
- à la lecture d'un fichier
- à la validation d'un article édité
*/
export async function decore (data) {
    data.erreurs = []
    let e
    for (let i = 0, f = null; (f = colonnes[i]); i++) {
        e = await maj(data, f, data[f])
        if (e) { data.erreurs.push(e) }
    }
}

/*
Cette fonction contrôle si la valeur 'val' pour une colonne 'col' d'un article 'data' est correcte ou non.
De plus elle décore data avec des propriétés calculées.
Option "simple" : si true, le controle est allégé pour une image.
Celle-ci n'est pas générée depuis sa base64 (ce qui prend du temps) et qu'on veut éviter quand on est sûr que c'est une bonne image.
Quand l'appel vient de l'éditeur d'article, la valeur val n'est pas déjà mise dans l'article : en particulier quand il y a une erreur
Retourne le libellé de l'erreur détectée (ou '' si OK). Ce libellé commence par le nom de la colonne (voir l'édition d'un article)
*/
export async function maj (data, col, val, simple) {
    switch (col) {
        case 'id' : {
            try {
                /*
                Le code court est, soit explicité en tête du nom, soit calculé depuis l'id
                */
                const n = nChiffres(val, 6)
                if (n === false) { return 'id non numérique compris entre 1 et 999999' }
                data.id = val
                data.codeCourt = codeCourtDeId(data.id, data.nom)
                return ''
            } catch (e) {
                return 'id non numérique compris entre 1 et 999999'
            }
        }
        case 'nom' : {
            if (!val || val.length < 4 || val.length > 100) return 'nom absent ou de longueur < 4 ou > 100'
            /*
            Le code court est, soit explicité en tête du nom, soit calculé depuis l'id
            On détermine aussi si c'est BIO et pour un article à l'unité son poids moyen éventuel
            */
            data.nom = val
            data.codeCourt = codeCourtDeId(data.id, data.nom)
            data.nomN = removeDiacritics(data.nom.toUpperCase())
            data.bio = (data.nomN.indexOf('BIO') !== -1)
            return ''
        }
        case 'prix' : {
            let e = centimes(val)
            if (e === false) return 'prix absent ou n\'est ni un décimal (avec au plus 2 chiffres après le point), ni un entier'
            if (e === 0 || e > 999999) {
                return 'prix en centimes nul ou supérieur à 999999'
            } else {
                data.prixN = e
                data.prix = formatPrix(e)
                data.prixS = '' + e
                return ''
            }
        }
        case 'unite' : {
            if (!val || (!val.startsWith('Unit') && val !== 'kg')) return 'unite doit valoir "Unite(s) ou Unité(s)" ou "kg" - [' + val + '] trouvé'
            data.unite = val.startsWith('Unit') ? 'Unite(s)' : 'kg'
            return ''
        }
        case 'code-barre' : {
            let [err, cb] = editEAN(val)
            if (err) return err
            data['code-barre'] = cb
            return ''
        }
        case 'categorie' : {
            data.categorie = val
            return ''
        }
        case 'image' : {
            /*
            L'image est encodée en base64.
            - il faut au moins que ce texte soit du base64 correct (la construction du Buffer échoue sinon)
            - que le binaire correspondant soit vraiment une image et qu'on en obtienne la largeur et la hauteur.
            Cette dernière vérification n'est faite que quand le base64 vient d'un fichier.
            S'il vient déjà d'une image par l'éditeur c'est inutile et coûteux.
            C'est me dule Jimp qui permet d'obtenir l'image (qu'on ne garde pas d'ailleurs)
            */
            if (!val) {
                data.image = ''
                data.imagel = 0
                data.imageh = 0
                return ''
            }
            let buffer
            try {
                buffer = Buffer.from(val, 'base64')
                if (!buffer) { return 'image mal encodée (pas en base64)' }
            } catch (err) {
                return 'image mal encodée (pas en base64)' + err.message
            }
            data.image = val || ''
            if (!simple) {
                try {
                    let img = await Jimp.read(buffer)
                    data.imagel = img.bitmap.width
                    data.imageh = img.bitmap.height
                } catch (err) {
                    return 'image non affichable : ' + err.message
                }
            }
        }
    }
}
