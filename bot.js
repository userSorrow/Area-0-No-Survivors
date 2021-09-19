//@ts-check
require("dotenv").config()

const { Client, MessageEmbed, MessageAttachment } = require("discord.js")
const bot = new Client()
const PREFIX = "$"

bot.login(process.env.AREA0_BOT_TOKEN)

bot.on("ready", () => {
  console.log(`${bot.user.tag} has logged in.`)
})

bot.on('message', (message) => {
  if (message.author.bot) return
  if (message.content.startsWith(PREFIX)) {
    const [CMD_NAME, ...args] = message.content
      .toLowerCase()
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/)

    switch (CMD_NAME) {
      case "hello":
        message.channel.send("Hi, " + message.author.toString())
        break
      case "h":
      case "help":
        message.channel.send({ embed: helpEmbed })
        break
      case "c":
      case "create":
        if (!Player.allIds.includes(message.author.id)) {
          const player = new Player(message.author)
          message.reply(`created player **${player.user.username}**`)
        } else {
          message.reply("you already created a player")
        }
        break
      case "game":
        const game = Game.all[0] // change 0 to variable for multiple games
        message.channel.send({ embed: game.info })
        break
      case "p":
      case "profile":
      case "j":
      case "join":
        if (!Player.allIds.includes(message.author.id)) {
          message.reply("create a player first")
        }
        break
    }

    if (!Player.allIds.includes(message.author.id)) return // anything below is for players who already have characters
    const player = Player.all[Player.allIds.indexOf(message.author.id)] // gets player's object

    switch (CMD_NAME) {
      case "p":
      case "profile":
        message.channel.send({ embed: player.profile })
        break
      case "j":
      case "join":
        const game = Game.all[0] // change 0 to variable for multiple games
        const errorMessage = game.addPlayer(player)

        if (errorMessage) {
          message.reply(errorMessage)
        } else {
          message.channel.send(`**${message.author.username}** joined **${game.name}**`)
        }
        break
    }

    if (player.currentGame.name === "No Game") return // anything below is for players already in a game

    switch (CMD_NAME) {
      case "start":
        const errorMessage = player.currentGame.start()

        if (errorMessage) {
          message.reply(errorMessage)
        } else {
          let startingMessage = ""
          player.currentGame.players.forEach(participant => {
            startingMessage += `${participant.user.toString()} `
          })
          startingMessage += `**${player.currentGame.name}** is starting!`

          message.channel.send(startingMessage)
        }
        break
    }
  }
})

const helpEmbed = new MessageEmbed()
  .setColor("#ebe700")
  .setTitle("Commands") // documentation: https://discordjs.guide/popular-topics/embeds.html#using-the-embed-constructor
  .addFields(
    { name: "Player Creation Commands", value: "`create`, `profile`, `join`" }
  )

class Game {
  constructor() {
    this._players = []
    this._name = `Game ${Game.all.push(this)}`
    this._started = false;

    console.log(`Created ${this.name}`)
  }

  get name() {
    return this._name
  }

  get players() {
    return this._players
  }

  addPlayer(player) {
    if (player.currentGame.name !== "No Game") {
      return `you are already in a game!`
    } else if (this._started) {
      return `${this._name} has already started! Could not join game`
    } else if (this._players.length === 10) {
      return `${this._name} is full! Could not join game`
    } else {
      this._players.push(player)
      player.setGame(this)
      console.log(`Adding ${player.user.username} to ${this.name}`)
      return false
    }
  }

  start() {
    if (this._started) return "game has already started"
    this._started = true
    return false
  }

  get info() {
    let playersString = ""
    this.players.forEach(player => {
      playersString += `**${player.user.tag}** \n`
    })

    return new MessageEmbed()
      .setColor("#009133")
      .setTitle(`${this.name} Info`)
      .setDescription(`**Started**: ${this._started}`)
      .addFields(
        { name: "Players", value: playersString },
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  static all = []
}

class Player {
  constructor(user) {
    this._user = user

    this._currentGame = { name: "No Game" }
    this._location = "none"
    this._health = 100
    this._cooldowns = {
      movement: 0,
      attack: 0
    }

    this._primary = fists
    this._secondary = "none"
    this._inventory = []

    Player.allIds.push(this.user.id)
    Player.all.push(this)
    console.log(`Created player ${this.user.username} (ID: ${this.user.id})`)
  }

  get user() {
    return this._user
  }

  get currentGame() {
    return this._currentGame
  }

  get location() {
    return this._location
  }

  get health() {
    return this._health
  }

  get cooldowns() {
    return this._cooldowns
  }

  get primary() {
    return this._primary
  }

  get secondary() {
    return this._secondary
  }

  get inventory() {
    return this._inventory
  }

  setGame(newGame) {
    this._currentGame = newGame
  }

  loseHp(damage) {
    if (this.health < damage) {
      this._health = 0
    } else {
      this._health -= damage
    }
  }

  /**
   * 
   * @param {Player} target 
   */
  attack(target) {
    if (this.location === target.location) {
      target.loseHp(this.primary.damage)
    }
  }

  addItem(item) {
    if (this._inventory.length === 3) {
      return false
    } else {
      this._inventory.push(item)
    }
  }

  get profile() {
    return new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`${this.user.username} in ${this.currentGame.name}`)
      .setThumbnail(this.user.avatarURL())
      .addFields(
        { name: "Stats", value: `**Location**: ${this._location}\n **Health**: ${this._health}` },
        { name: "Weapons", value: `**Primary**: ${this.primary.name}\n **Secondary**: ${this.secondary}` },
        { name: "Item 1", value: this.inventory[0], inline: true },
        { name: "Item 2", value: this.inventory[1], inline: true },
        { name: "Item 3", value: this.inventory[2], inline: true }
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  static allIds = [] // contains all the playerIds
  static all = [] // contains all the players
}


class Weapon {
  /**
   * 
   * @param {*} icon 
   * @param {string} name 
   * @param {number} hitDelay 
   * @param {number} hitCooldown 
   * @param {number} damage 
   */
  constructor(icon, name, hitDelay, hitCooldown, damage) {
    this._icon = icon
    this._name = name
    this._hitDelay = hitDelay
    this._hitCooldown = hitCooldown
    this._damage = damage

    Weapon.all.push(this)
  }

  get icon() {
    return this._icon
  }

  get name() {
    return this._name
  }

  get hitDelay() {
    return this._hitDelay
  }

  get hitCooldown() {
    return this._hitCooldown
  }

  get damage() {
    return this._damage
  }

  static all = []
}

class Item {
  constructor(name, time, action) {
    this._name = name
    this._time = time
    this._action = action // callback function?
  }
}

// First Game
new Game();

// Weapons
const fists = new Weapon(false, "fists", 1, 2, 15)
const rifle = new Weapon(false, "rifle", 0, 3, 33)

// Items
const bandages = new Item("bandages", 10, {}) // NOT DONE


//Help command
// Time/action = how much longer till action ends
// heal
// Look around
// goto
