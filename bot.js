//@ts-check
require("dotenv").config()

const { Client, MessageEmbed, MessageAttachment } = require("discord.js")
const bot = new Client()
const PREFIX = "$"

bot.login(process.env.AREA0_BOT_TOKEN)

bot.on("ready", () => {
  console.log(`${bot.user.tag} has logged in.`)
})

const numbers = ["1", "2", "3", "4", "5"]

bot.on('message', (message) => {
  if (message.author.bot) return
  if (message.content.startsWith(PREFIX)) {
    const [CMD_NAME, ...args] = message.content
      .toLowerCase()
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/)

    let justCreated = false
    switch (CMD_NAME) {
      case "hello":
        return message.channel.send("Hi, " + message.author.toString())
      case "h":
      case "help":
        return message.channel.send({ embed: helpEmbed })
      case "c":
      case "create":
        if (!Player.allIds.includes(message.author.id)) {
          const player = new Player(message.author)
          justCreated = true
          return message.reply(`created player **${player.user.username}**`)
        } else {
          return message.reply("you already created a player")
        }
      case "game":
        const game = Game.all[0] // change 0 to variable for multiple games
        return message.channel.send({ embed: game.info })
      case "p":
      case "profile":
      case "j":
      case "join":
        if (!Player.allIds.includes(message.author.id)) {
          message.reply("create a player first")
        }
        break
    }

    const playerInd = Player.allIds.indexOf(message.author.id)
    if (playerInd === -1 || justCreated) return // anything below is for players who already have characters
    const player = Player.all[playerInd] // gets player's object

    const stillAlive = Object.keys(player).includes("_user") && player.health > 0
    if (!stillAlive) return message.channel.send({ embed: deathProfile(message.author) }) // anything below is for players with alive characters

    switch (CMD_NAME) {
      case "p":
      case "profile":
        return message.channel.send({ embed: player.profile })
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
          startingMessage += `**${player.currentGame.name}** has started!`

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
    // debug
    function playerDie(deadPlayer) {
      message.channel.send(`${deadPlayer.user.toString()}, you died! Deleting your character. . .`)
      message.channel.send(deathProfile(deadPlayer.user))
      deadPlayer.deleteThis()
    }

    if (CMD_NAME === "debug") {
      switch (args[0]) {
        case "die":
          player.loseHp(100)
          return playerDie(player)
      }
    }

    // Battle Commands
    switch (CMD_NAME) {
      case "a":
      case "attack":
        if (args.length === 0) return message.reply("include who you are attacking")
        const targetStr = args[0]
        if (numbers.includes(targetStr)) {
          const target = player.currentGame.players[numbers.indexOf(targetStr)]
          if (target === undefined) return message.reply("no target has that number")

          const errorMessage = player.attack(target)
          if (errorMessage) {
            message.reply(errorMessage)
          } else {
            message.channel.send(`**${player.pName}** attacked **${target.pName}** with **${player.primary.name}**`)
            if (target.health === 0) {
              playerDie(target)
            }
          }
        }
        break
      case "l":
      case "look":
        message.channel.send({ embed: player.roomInfo })
        break
      case "go":
      case "room":
      case "m":
      case "move": {
        if (args.length === 0) return message.reply("include where you want to move")

        const targetRoom = args[0].toUpperCase()
        const errorMessage = player.moveTo(targetRoom)
        if (errorMessage) return message.reply(errorMessage)

        return message.channel.send(`**${player.pName}** moved to **${player.location}**`)
      }
      case "stairs": {
        const errorMessage = player.useStairs()
        if (errorMessage) return message.reply(errorMessage)

        return message.channel.send(`**${player.pName}** moved to **${player.location}**`)
      }
      case "cd":
      case "cooldowns":
        message.channel.send({ embed: player.cooldownInfo })
        break
      case "switch": {
        const errorMessage = player.switchWeapons()
        if (errorMessage) {
          message.reply(errorMessage)
        } else {
          message.channel.send(`**${player.pName}** switched to weapon **${player.primary.name}**`)
        }
        break
      }
      case "e":
      case "equip":
        if (args.length === 0) return message.reply("include which the number of the weapon you want to equip")
        const weaponNumString = args[0]
        if (!numbers.includes(weaponNumString)) return message.reply("no weapon has that number")
        const weaponNum = numbers.indexOf(weaponNumString) + 1
        const errorMessage = player.equip(weaponNum)
        if (errorMessage) {
          message.reply(errorMessage)
        } else {
          message.channel.send(`**${player.pName}** equipped **${player.primary.name}** as primary`)
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
    { name: "Game Manage Commands", value: "`start`, `end` " },
    { name: "Battle Commands", value: "`attack` " }
  )


/**
 * 
 * @param {array} arr 
 * @returns random element of arr
 */
function getRandomElementFrom(arr) {
  const randomInd = Math.floor(Math.random() * arr.length)
  return arr[randomInd]
}

/**
 * 
 * @param {array} arr 
 * @param {array} properties 
 * @param {boolean} isNumbered 
 * @returns 
 */
function propertiesStringify(arr, properties, isNumbered) {
  let numberedString = ""
  for (let i = 0; i < arr.length; i++) {
    let value = arr[i]
    properties.forEach(property => {
      value = value[property]
    })

    let number = ""
    if (isNumbered) {
      number = `[${i + 1}] `
    }

    numberedString += `${number}${value}\n`
  }
  if (numberedString === "") {
    numberedString = "none"
  }

  return numberedString
}

function deathProfile(player) {
  return new MessageEmbed()
    .setColor("#940115")
    .setTitle(`${player.username}`)
    .setThumbnail(player.avatarURL())
    .setDescription("☠️ You are dead! ☠️\n" + "Removing your character. . .")

}

class Game {
  constructor() {
    this._players = []
    this._name = `Game ${Game.all.push(this)}`
    this._started = false
    this._timeInterval = setInterval(() => console.log(`${this.name} passed 1 more min`), 60000)
    this._mapAreas = {
      floor1: {
        R1: {
          weapons: [],
          items: [],
          exits: ["H1", "H2"]
        },

        H1: {
          exits: ["R1", "R2", "R3"]
        },

        R2: {
          weapons: [],
          items: [],
          exits: ["H1"],
          stairsTo: "H3"
        },

        H2: {
          exits: ["R1", "R3"],
          stairsTo: "H4"
        },

        R3: {
          weapons: [],
          items: [],
          exits: ["H1", "H2"]
        },

        Safe: {
          weapons: [],
          items: [],
          exits: [],
          stairsTo: "R6"
        }
      },

      floor2: {
        R4: {
          weapons: [],
          items: [],
          exits: ["H3", "H4"]
        },

        H3: {
          exits: ["R4", "R5"],
          stairsTo: "R2"
        },

        H4: {
          exits: ["R4", "R5"],
          stairsTo: "H2"
        },

        R5: {
          weapons: [],
          items: [],
          exits: ["H3", "H4", "H5", "R6"] // R6 exit is via a tunnel
        },

        H5: {
          exits: ["R5"]
        },

        R6: {
          exits: ["R5"], // No items for Room 6
          stairsTo: "Safe"
        },
      }
    }

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

  get mapAreas() {
    return this._mapAreas
  }

  playersIn(room) {
    return this.players.filter(player => player.room = room)
  }

  hasStairsIn(room) {
    const floorInd = Object.keys(this._mapAreas.floor1).includes(room) ? 0 : 1 // index of floor of location
    const floor = Object.keys(this._mapAreas)[floorInd]
    return Object.keys(this._mapAreas[floor][room]).includes("stairsTo")
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
    Weapon.randomlyAddTo(this)
    this.players.forEach(player => {
      player.randomizeLocation()
    })
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

  removePlayer(player) {
    const playerInd = this.players.indexOf(player)
    this.players.splice(playerInd, 1)
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

    this._currentGame = { name: "No Game", mapAreas: {} }
    this._location = "none"
    this._health = 100
    this._cooldowns = {
      _switch: 0,
      _movement: 0,
      _action: 0,

      get switchWeapon() {
        return this._switch
      },
      get movement() {
        return this._movement
      },
      get action() {
        return this._action
      }
    }

    this._primary = weaponFists
    this._secondary = weaponFists
    this._inventory = []

    Player.allIds.push(this.user.id)
    Player.all.push(this)
    console.log(`Created player ${this.user.username} (ID: ${this.user.id})`)
  }

  get user() {
    return this._user
  }

  /**
   * gets Player Number + Player Name
   */
  get pName() {
    return `[P${this.currentGame.players.indexOf(this) + 1}] ${this.user.username}`
  }

  get currentGame() {
    return this._currentGame
  }

  get location() {
    return this._location
  }

  get floor() {
    const floorInd = Object.keys(this.currentGame.mapAreas.floor1).includes(this.location) ? 0 : 1 // index of floor of location
    return Object.keys(this.currentGame.mapAreas)[floorInd]
  }

  get currentExits() {
    return this.currentGame.mapAreas[this.floor][this.location].exits
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

  get availableItems() {
    const player = this
    return {
      weapons: player.currentGame.mapAreas[player.floor][player._location].weapons || [],
      items: player.currentGame.mapAreas[player.floor][player._location].items || [],
    }
  }

  get roomInfo() {
    const weaponsString = propertiesStringify(this.availableItems.weapons, ["name"], true)
    const itemsString = propertiesStringify(this.availableItems.items, ["name"], true)
    const nearbyPlayers = this.currentGame.playersIn(this._location)
    const playersString = propertiesStringify(nearbyPlayers, ["pName"], false)
    let exitsString = this.currentExits.join(", ")
    if (this.currentGame.hasStairsIn(this.location)) {
      exitsString += `, stairs: ${this._currentGame.mapAreas[this.floor][this.location].stairsTo}`
    }

    return new MessageEmbed()
      .setColor("#dbaa48")
      .setTitle(`Location ${this.location}`)
      .setAuthor(`${this.user.username} in ${this.currentGame.name}`, this.user.avatarURL())
      .addFields(
        { name: "Weapons", value: weaponsString },
        { name: "Items", value: itemsString },
        { name: `Players in ${this.location}`, value: playersString },
        { name: "Exits", value: exitsString }
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  get inventory() {
    return this._inventory
  }

  setGame(newGame) {
    this._currentGame = newGame
  }

  randomizeLocation() {
    const takenLocations = this.currentGame.players.map(player => player.location)
    const newFloor = getRandomElementFrom(Object.keys(this.currentGame.mapAreas))
    const newLocations = Object.keys(this.currentGame.mapAreas[newFloor])
      .filter(room => room.charAt(0) === 'H') // can be single or double quotes
      .filter(room => !takenLocations.includes(room))

    this._location = getRandomElementFrom(newLocations)
  }

  moveTo(room) {
    if (this._cooldowns._movement > 0) return `you have a **${this.cooldowns.movement}s** cooldown for moving!`
    if (!this.currentExits.includes(room)) return "not a current exit!"
    this._location = room

    this._cooldowns._movement = 2
    this._decreaseMoveCooldown()
    return false
  }

  useStairs() {
    const locationHasStairs = Object.keys(this.currentGame.mapAreas[this.floor][this.location]).includes("stairsTo")
    if (!locationHasStairs) {
      return `${this.location} does not have stairs`
    } else {
      this._location = this.currentGame.mapAreas[this.floor][this.location].stairsTo
    }
  }

  _decreaseMoveCooldown() {
    setTimeout(() => {
      this._cooldowns._movement -= 0.5
      if (this.cooldowns.movement > 0) {
        this._decreaseMoveCooldown()
      }
    }, 500)
  }

  _decreaseActionCooldown() {
    setTimeout(() => {
      this._cooldowns._action -= 0.5
      if (this.cooldowns.action > 0) {
        this._decreaseActionCooldown()
      }
    }, 500)
  }

  setActionCooldown(cooldown) {
    this._cooldowns._action = cooldown

    this._decreaseActionCooldown()
  }

  _decreaseSwitchCooldown() {
    setTimeout(() => {
      this._cooldowns._switch -= 0.5
      if (this.cooldowns._switch > 0) {
        this._decreaseSwitchCooldown()
      }
    }, 500)
  }

  get cooldownInfo() {
    return new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`${this.user.username}'s Cooldowns`)
      .setDescription(`Movement Cooldown: ${this.cooldowns.movement}s\n` +
        `Action Cooldown: ${this.cooldowns.action}s\n` +
        `Switch Weapon Cooldown: ${this.cooldowns.switchWeapon}s`)
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  loseHp(damage) {
    if (this.health < damage) {
      this._health = 0
    } else {
      this._health -= damage
    }
  }

  /**
   * Remember to ping target and ping player
   * @param {Player} target 
   * @returns an errorMessage or false
   */
  attack(target) {
    if (this.cooldowns.action > 0) return `you have a **${this.cooldowns.action}s** cooldown for attacking!`
    if (this.location !== target.location) return `${target.user.username} is too far away!`

    this.setActionCooldown(this.primary.cooldown)
    target.loseHp(this.primary.damage)
  }

  switchWeapons() {
    if (this.cooldowns.switchWeapon > 0) return `you have a **${this.cooldowns.switchWeapon}s** cooldown for switching weapons!`

    const primaryTemp = this._primary
    this._primary = this._secondary
    this._secondary = primaryTemp
    this._cooldowns._switch = 2
    this._decreaseSwitchCooldown()
  }

  equip(weaponNumber) {
    const inWeaponRoom = Object.keys(this.currentGame.mapAreas[this.floor][this.location]).includes("weapons")
    if (inWeaponRoom) {
      const roomHasWeapon = weaponNumber > 0 && weaponNumber <= this.currentGame.mapAreas[this.floor][this.location].weapons.length
      // "<=" because weaponNumber is index + 1
      if (roomHasWeapon) {
        const weaponInd = weaponNumber - 1
        const roomWeapons = this.currentGame.mapAreas[this.floor][this.location].weapons

        if (this._primary.name !== "Fists") roomWeapons.push(this._primary)
        this._primary = roomWeapons[weaponInd]
        roomWeapons.splice(weaponInd, 1)
      } else {
        return `no weapon has that number`
      }
    } else {
      return `no weapons here`
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
    this._currentGame = { name: "No Game", mapAreas: {} }
    this._location = "none"
    this._health = 100
    this._cooldowns = {
      _switch: 0,
      _movement: 0,
      _action: 0,

      get switchWeapon() {
        return this._switch
      },
      get movement() {
        return this._movement
      },
      get action() {
        return this._action
      }
    }

    this._primary = weaponFists
    this._secondary = weaponFists
    this._inventory = []
  }

  deleteThis() {
    const properties = Object.keys(this)
    const playerTag = this.user.tag
    const timeDelay = (Math.max(this.cooldowns.movement, this.cooldowns.action) + 0.5) * 1000 // requires a time delay so this.decrease*Cooldown does not cause an error

    setTimeout(() => {
      Player.remove(this)
      this.currentGame.removePlayer(this)
      properties.forEach(property => {
        delete this[property]
      })

      console.log(`deleted ${playerTag}`)
    }, timeDelay)
  }

  get profile() {
    return new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`${this.user.username} in ${this.currentGame.name}`)
      .setThumbnail(this.user.avatarURL())
      .addFields(
        { name: "Stats", value: `**Location**: ${this._location}\n` + `**Health**: ${this._health}` },
        { name: "Weapons", value: `**Primary**: ${this.primary.name}\n` + `**Secondary**: ${this.secondary.name}` },
        { name: "Item 1", value: this.inventory[0], inline: true },
        { name: "Item 2", value: this.inventory[1], inline: true },
        { name: "Item 3", value: this.inventory[2], inline: true }
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  static allIds = [] // contains all the playerIds
  static all = [] // contains all the players
  static remove(player) {
    const playerInd = Player.allIds.indexOf(player.user.id)
    Player.allIds.splice(playerInd, 1)
    Player.all.splice(playerInd, 1)
  }
}


class Weapon {
  /**
   * 
   * @param {*} icon 
   * @param {string} name 
   * @param {number} cooldown 
   * @param {number} damage 
   * @param {number} numCopies how many of this weapon that can be added in each game
   */
  constructor(icon, name, cooldown, damage, numCopies) {
    this._icon = icon
    this._name = name
    this._numCopies = numCopies
    this._copiesLeft = numCopies
    this._cooldown = cooldown
    this._damage = damage

    Weapon.all.push(this) // never change the properties: each weapon is used by multiple players in multiple games
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
  static _chooseRandom() {
    const remainingSet = Weapon.all.filter(weapon => weapon._copiesLeft > 0) // makes a new copy of available weapons; weapons with no more copies are removed

    return getRandomElementFrom(remainingSet) // copy, not reference
  }

  /**
   * Adds a random weapon to every weapon room in a Game object
   * @param {Game} game 
   */
  static randomlyAddTo(game) {
    const floors = Object.keys(game.mapAreas)
    floors.forEach(floor => {
      const floorRooms = Object.keys(game.mapAreas[floor]).filter(room => Object.keys(game.mapAreas[floor][room]).includes("weapons"))
      game.mapAreas.floor1.Safe.weapons.push(weaponRifle) // guaranteed extra rifle in Safe room
      weaponRifle._copiesLeft--

      floorRooms.forEach(room => {
        const addedWeapon = Weapon._chooseRandom()
        addedWeapon._copiesLeft--

        game.mapAreas[floor][room].weapons.push(addedWeapon)
      })
    })
  }
}

class Item {
  constructor(name, time, action) {
    this._name = name
    this._time = time
    this._action = action // callback function?
  }

  get name() {
    return this._name
  }
}

// Weapons
const weaponFists = new Weapon(false, "Fists", 3, 13, 0)
const weaponRifle = new Weapon(false, "Rifle", 4, 33, 3)
const weaponPistol = new Weapon(false, "Pistol", 4, 18, 5)
const weaponSword = new Weapon(false, "Sword", 8, 60, 1)


// Items
const bandages = new Item("bandages", 10, {}) // NOT DONE

// First Game
new Game()
