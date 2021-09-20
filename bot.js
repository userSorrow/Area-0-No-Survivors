//@ts-check
require("dotenv").config()

const { Client, MessageEmbed, MessageAttachment } = require("discord.js")
const bot = new Client()
const PREFIX = "$"

bot.login(process.env.AREA0_BOT_TOKEN)

bot.on("ready", () => {
  console.log(`${bot.user.tag} has logged in.`)
})

const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]

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
      case "end":
        let endingMessage = ""
        player.currentGame.players.forEach(participant => {
          endingMessage += `${participant.user.toString()} `
        })
        endingMessage += `**${player.currentGame.name}** has ended!`

        player.currentGame.end()

        message.channel.send(endingMessage)
        break
    }

    if (!player.currentGame.started) return // anything below is for players in an active game
    // Battle Commands
    switch (CMD_NAME) {
      case "a":
      case "attack":
        if (args.length === 0) return message.reply("who are you attacking?")
        const targetStr = args[0]
        if (numbers.includes(targetStr)) {
          const target = player.currentGame.players[numbers.indexOf(targetStr)]
          if (target === undefined) return message.reply("no target has that number")

          const errorMessage = player.attack(target)
          if (errorMessage) {
            message.reply(errorMessage)
          } else {
            message.channel.send(`**${player.user.username}** attacked **${target.user.username}** with **${player.primary.name}**`)
          }
        }
        break
    }
  }
})

const helpEmbed = new MessageEmbed()
  .setColor("#ebe700")
  .setTitle("Commands") // documentation: https://discordjs.guide/popular-topics/embeds.html#using-the-embed-constructor
  .addFields(
    { name: "Player Commands", value: "`create`, `profile`, `join`" },
    { name: "Game Manage Commands", value: "`start`, `end` "},
    { name: "Battle Commands", value: "`attack` "}
  )

class Game {
  constructor() {
    this._players = []
    this._name = `Game ${Game.all.push(this)}`
    this._started = false
    this._timeInterval = setInterval(() => console.log(`${this.name} passed 1 more min`), 60000)

    console.log(`Created ${this.name}`)
  }

  get name() {
    return this._name
  }

  get started() {
    return this._started
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

  end() {
    clearInterval(this._timeInterval)
    this._started = false // or remove game?
    this.players.forEach(player => {
      player.reset()
    })
    this._players = []
    console.log(`${this.name} has ended!`)
  }

  get info() {
    let playersString = ""
    for (let i = 0; i < this.players.length; i++) {
      playersString += `[P${i + 1}] **${this.players[i].user.tag}** \n`
    }
    
    if (playersString === "") {
      playersString = "none"
    }

    return new MessageEmbed()
      .setColor("#009133")
      .setTitle(`${this.name} - Info`)
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
      _movement: 0,
      _action: 0,

      get movement() {
        return this._movement
      },
      get action() {
        return this._action
      }
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

  setMoveCooldown(cooldown) { // CHANGE
    this._cooldowns._movement = cooldown

    function decreaseCD() {
      setTimeout(() => {
        this._cooldowns._movement -= 0.1
        if (this.cooldowns.movement > 0) {
          decreaseCD()
        }
      }, 100)
    }

    decreaseCD()
  }

  _decreaseActionCooldown() {
    setTimeout(() => {
      this._cooldowns._action -= 0.25
      console.log(this._cooldowns._action)
      if (this.cooldowns.action > 0) {
        this._decreaseActionCooldown()
      }
    }, 250)
  }

  setActionCooldown(cooldown) {
    this._cooldowns._action = cooldown
    
    this._decreaseActionCooldown()
  }

  loseHp(damage) {
    if (this.health < damage) {
      this._health = 0
    } else {
      this._health -= damage
    }
  }

  /**
   * Remember to ping target and player
   * @param {Player} target 
   * @returns an errorMessage or false
   */
  attack(target) {
    if (this.cooldowns.action > 0) {
      return `you have a **${this.cooldowns.action}s** cooldown!`
    } else if (this.location !== target.location) {
      return `${target.user.username} is too far away!`
    } else {
      this.setActionCooldown(this.primary.cooldown)
      target.loseHp(this.primary.damage)
      return false
    }
  }

  addItem(item) {
    if (this._inventory.length === 3) {
      return false
    } else {
      this._inventory.push(item)
    }
  }

  reset() {
    this._currentGame = { name: "No Game" }
    this._location = "none"
    this._health = 100
    this._cooldowns = {
      _movement: 0,
      _action: 0,

      get movement() {
        return this._movement
      },
      get action() {
        return this._action
      }
    }

    this._primary = fists
    this._secondary = "none"
    this._inventory = []
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
   * @param {number} cooldown 
   * @param {number} damage 
   */
  constructor(icon, name, cooldown, damage) {
    this._icon = icon
    this._name = name
    this._cooldown = cooldown
    this._damage = damage

    Weapon.all.push(this)
  }

  get icon() {
    return this._icon
  }

  get name() {
    return this._name
  }

  get cooldown() {
    return this._cooldown
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
const fists = new Weapon(false, "fists", 3, 15)
const rifle = new Weapon(false, "rifle", 4, 33)

// Items
const bandages = new Item("bandages", 10, {}) // NOT DONE


//Help command
// Time/action = how much longer till action ends
// heal
// Look around
// goto

