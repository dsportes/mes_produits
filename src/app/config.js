/*
Le module 'config' récupère le fichier config.json et exporte l'objet correspondant 'config'.
Il est exactement identique dans "balance" et "produits".
Le fichier config.json est dans le directory de travail :
- soit dans le home directory sous le nom balance : ~/balance
- soit passé sur la ligne de commande en option : balance dir=/home/machin/mabalance1
En cas d'erreur une boîte de dialogue module informe l'utilisateur et sort de l'application.
La propriété config.version donne la version de l'application en production (en développement c'est celle de Quasar, on s'en fiche).
La méthode quit() de config sort de l'application.
La méthode msgbox affiche un message modal et sort ou non de l'application.
*/

import path from 'path'
import fs from 'fs'
import { remote } from 'electron'

class Config {
    quit () {
        remote.app.quit()
    }
    msgbox (message, detail, quit) {
        remote.dialog.showMessageBoxSync({ type: 'error', buttons: ['Lu'], message: message, detail: detail })
        if (quit) this.quit()
    }
    veriflock () {
        this.timer = setTimeout(() => {
            const x = fs.readFileSync(this.lockpath, { encoding: 'utf8', flag: 'r' })
            if (x === this.lock) {
                this.veriflock()
            } else {
                this.quit()
                // config.msgbox('L\'application a été relancée alors qu\'elle était déjà en exécution. Arrêt immédiat.', 'Double clic ? Arrêter et relancer le PC ?', true)
            }
        }, 5000)
    }
}
export const config = new Config()

let dir

try {
    config.version = remote.app.getVersion()
    const argv = remote.process.argv
    for (let i = 0; i < argv.length; i++) {
        const x = argv[i]
        if (x && x.startsWith('dir=')) {
            dir = x.substring(4)
            break
        }
    }
    if (!dir) { dir = require('os').homedir() + '/balance' }
    config.dir = path.normalize(dir)
    config.lockpath = path.join(config.dir, 'lock.txt')
    config.lock = new Date().toUTCString()
    fs.writeFileSync(config.lockpath, config.lock, (err) => { config.msgbox('Impossible d\'accéder au fichier de protection ' + config.dir + 'lock.txt', err.message, true) })
    config.veriflock()
} catch (e) {
    config.msgbox('Configuration config.json incorrecte ou non trouvée dans ' + config.dir, e.message, true)
}
