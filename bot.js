/**
 * Finished: 27 September 2021 at 8:11 PM
 * Updated: 27 September 2021 at 11:10 PM
 * Finalized: 27 September 2021 at 11:17 PM
 */

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
    let justCreatedProfile = false

    const [CMD_NAME, ...args] = message.content
      .toLowerCase()
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/)


    switch (CMD_NAME) {
      case "hello":
        return message.channel.send("Hi, " + message.author.toString())
      case "h":
      case "help":
        if (args.length === 0) return message.channel.send({ embed: CommandInfo.helpEmbed })
        const commandName = args[0]
        const command = CommandInfo.find(commandName)
        if (!command) return message.reply("Could not find command `" + commandName + "`. It cannot be an alias.")
        return message.channel.send(command.info)
      case "c":
      case "create":
        if (!Player.allIds.includes(message.author.id)) {
          const player = new Player(message.author, message.channel)
          justCreatedProfile = true
          return message.reply(`created player **${player.user.username}**`)
        } else {
          return message.reply("you already created a player")
        }
      case "new": {
        const userId = message.author.id
        const allGameIds = Game.all.map(game => game.creatorId)
        if (allGameIds.includes(userId)) return message.reply("you already made a game")
        const game = new Game(userId)
        return message.channel.send(`Created new game, **${game.name}**`)
      }
      case "game": {
        const gameNumber = args[0] || 1
        const game = Game.find(gameNumber)
        if (game === false) return message.reply("no game has that number!")
        return message.channel.send({ embed: game.info })
      }
      case "games":
        return message.channel.send(Game.allInfo)
      case "map":
      case "maps":
        message.channel.send({ embed: mapInfo.floor1Embed })
        return message.channel.send({ embed: mapInfo.floor2Embed })
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
    if (playerInd === -1 || justCreatedProfile) return // anything below is for players who already have characters
    const player = Player.all[playerInd] // gets player's object
    const stillAlive = Object.keys(player).includes("_user") && player.health > 0

    switch (CMD_NAME) {
      case "p":
      case "profile":
        if (!stillAlive) return message.channel.send({ embed: player.deathProfile })
        return message.channel.send({ embed: player.profile })
      case "j":
      case "join":
        const gameNumber = args[0] || 1
        const game = Game.find(gameNumber)
        if (game === false) return message.reply("no game has that number!")

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
          const startingMessage = player.currentGame.players.map(participant => `${participant.user.toString()}`).join(", ") +
            `: **${player.currentGame.name}** has started!`

          message.channel.send(startingMessage)
        }
        break
      case "remove":
      case "delete": {
        const deleteMessage = player.currentGame.delete()
        return message.reply(deleteMessage)
      }
    }

    if (!player.currentGame.started || player.currentGame.ended || !stillAlive) return // anything below is for players in an active game with alive characters
    // debugging purposes
    if (CMD_NAME === "debug") {
      switch (args[0]) {
        case "die":
          player.currentGame.setLastHit("self hurty")
          player.loseHp(100)
          return player.die(player.pName)
      }
    }

    /* Battle Commands */

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
            message.channel.send(`**${player.pName}** attacked **${target.pName}** with **${player.primary.display}**`)
            player.currentGame.setLastHit(player.primary.name)
            if (target.health === 0) {
              target.die(player.pName)
            }
          }
        }
        break
      case "l":
      case "look":
      case "room":
        return message.channel.send({ embed: player.roomInfo })
      case "go":
      case "to":
      case "m":
      case "move": {
        if (args.length === 0) return message.reply("include where you want to move")

        const targetRoom = args[0].toUpperCase()
        const errorMessage = player.moveTo(targetRoom)
        if (errorMessage) return message.reply(errorMessage)

        return message.channel.send(`**${player.pName}** moved to **${player.location}**`)
      }
      case "stair":
      case "stairs": {
        const errorMessage = player.useStairs()
        if (errorMessage) return message.reply(errorMessage)

        return message.channel.send(`**${player.pName}** moved to **${player.location}**`)
      }
      case "cd":
      case "cooldown":
      case "cooldowns":
        return message.channel.send({ embed: player.cooldownInfo })
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
      case "equip": {
        if (args.length === 0) return message.reply("include the number of the weapon you want to equip")
        const inWeaponRoom = Object.keys(player.currentGame.mapAreas[player.floor][player.location]).includes("weapons")
        if (!inWeaponRoom || player.currentGame.mapAreas[player.floor][player.location].weapons.length === 0) return message.reply("no weapons in here")

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
      case "take":
      case "grab":
      case "g":
      case "get": {
        if (args.length === 0) return message.reply("include the number of the item you want to get")
        const inItemsRoom = Object.keys(player.currentGame.mapAreas[player.floor][player.location]).includes("items")
        if (!inItemsRoom || player.currentGame.mapAreas[player.floor][player.location].items.length === 0) return message.reply("no items in here")

        const itemNumString = args[0]
        if (!numbers.includes(itemNumString)) return message.reply("no item has that number")

        const itemNum = numbers.indexOf(itemNumString) + 1
        const itemName = player.currentGame.mapAreas[player.floor][player.location].items[itemNum - 1].display
        const errorMessage = player.getItem(itemNum)
        if (errorMessage) return message.reply(errorMessage)

        return message.channel.send(`**${player.pName}** got **${itemName}**`)
      }
      case "u":
      case "use": {
        const itemNumString = args[0] || "0"
        const itemNum = numbers.indexOf(itemNumString) + 1
        if (!numbers.includes(itemNumString) || itemNum < 1 || itemNum > 3) return message.reply("item's number must be 1, 2, or 3")

        const item = player.inventory[itemNum - 1]
        const errorMessage = player.use(itemNum)
        if (errorMessage) return message.reply(errorMessage)

        return message.channel.send(`**${player.pName}** used **${item.display}** to ${item.useDescription}`)
      }
    }

    if (player.currentGame.justFinished) {
      message.channel.send(player.currentGame.gameFinishedEmbed)
      player.currentGame.end()
    }
  }
})

/* Help Command */

class CommandInfo {
  /**
   * 
   * @param {string} name 
   * @param {array} aliases 
   * @param {string} usage 
   * @param {string} description 
   */
  constructor(name, aliases, usage, description) {
    this._name = name
    this._aliases = aliases
    this._usage = usage
    this._description = description

    CommandInfo.list.push(this)
  }

  get name() {
    return this._name
  }

  get info() {
    const aliasNames = this._aliases.map(alias => "`" + alias + "`").join(", ")
    const usage = "`" + PREFIX + this._usage + "`"
    return new MessageEmbed()
      .setColor("#ccc92d")
      .setTitle(`Command: ${this._name.toUpperCase()}`)
      .setThumbnail(bot.user.avatarURL())
      .setDescription(`Aliases: ${aliasNames}\n` +
        `Usage: ${usage}\n` +
        `Description: ${this._description}`)
  }

  static list = []
  static find(commandName) {
    const namesList = this.list.map(commandInfo => commandInfo.name)
    const commandInd = namesList.indexOf(commandName)
    if (commandInd === -1) return false
    return this.list[commandInd]
  }
  static get helpEmbed() {
    return new MessageEmbed()
      .setColor("#ebe700")
      .setTitle("Commands")
      .setThumbnail(bot.user.avatarURL())
      .addFields(
        { name: "Player Manage Commands", value: "`create`, `join`, `profile`" },
        { name: "Game Manage Commands", value: "`new`, `delete`, `games`, `game`, `start`, `maps`" },
        { name: "Location Commands", value: "`look`, `move`, `stairs`, `cooldowns`" },
        { name: "Weapon Commands", value: "`attack`, `equip`, `switch`, `cooldowns`" },
        { name: "Item Commands", value: "`get`, `use`, `cooldowns`" },
        { name: "Unrelated", value: "`hello`" }
      )
  }
}

const helpCreate = new CommandInfo("create", ["c"], "create", "Creates a player.")
const helpJoin = new CommandInfo("join", ["j"], "join [game number]", "You join a the game with the number [game number]. [game number] defaults to 1.")
const helpProfile = new CommandInfo("profile", ["p"], "profile", "Shows your profile. Must have created a player first.")
const helpNew = new CommandInfo("new", [], "new", "Makes a new game. Limit to 1 not-ended game per player.")
const helpDelete = new CommandInfo("delete", ["remove"], "delete", "Deletes your current game. The game must be finished to delete.")
const helpGame = new CommandInfo("game", [], "game [game number]", "Shows information about the game with number [game number]. [game number] defaults to 1.")
const helpGames = new CommandInfo("games", [], "games", "Lists all games and their information.")
const helpStart = new CommandInfo("start", [], "start", "Starts your current game.")
const helpLook = new CommandInfo("look", ["l", "room"], "look", "Shows room information, including weapons and items on the ground.")
const helpMove = new CommandInfo("move", ["m", "go", "to"], "move [room]", "Moves to [room]")
const helpStairs = new CommandInfo("stairs", ["stair"], "stairs", "Uses stairs and moves to the room where the stairs lead to.")
const helpCooldowns = new CommandInfo("cooldowns", ["cd", "cooldown"], "cooldowns", "Shows your current cooldowns")
const helpAttack = new CommandInfo("attack", ["a"], "attack [player number]", "Attacks the player with [player number]. The target must be in the same room.")
const helpEquip = new CommandInfo("equip", ["e"], "equip [weapon number]", "Equips a weapon in the room that has number [weapon number] to your primary. Your current primary will be dropped")
const helpSwitch = new CommandInfo("switch", [], "switch", "Switches your primary and secondary weapons")
const helpGet = new CommandInfo("get", ["g", "take", "grab"], "get [item number]", "Gets an item in the room that has number [item number]. Maxmimum 3 items on hand.")
const helpUse = new CommandInfo("use", ["u"], "use [item number]", "Uses an item you have with number [item number]. [item number] must be in the range of 1 - 3.")
const helpMaps = new CommandInfo("maps", ["map"], "maps", "Shows the maps of each floor.")



const mapInfo = {
  _attachment_map1: new MessageAttachment("./images/Area 0_Map 1.png", "map1.png"),
  _attachment_map2: new MessageAttachment("./images/Area 0_Map 2.png", "map2.png"),
  get floor1Embed() {
    return new MessageEmbed()
      .setColor("#ebe700")
      .setTitle("Map: Floor 1")
      .attachFiles([this._attachment_map1])
      .setImage("attachment://map1.png")
  },
  get floor2Embed() {
    return new MessageEmbed()
    .setColor("#ebe700")
    .setTitle("Map: Floor 2")
    .attachFiles([this._attachment_map2])
    .setImage("attachment://map2.png")
  }
}

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




class Game {
  /**
   * 
   * @param {string} [creatorId]
   */
  constructor(creatorId) {
    this._creatorId = creatorId

    this._players = []
    this._name = `Game ${Game.all.push(this)}`
    this._started = false
    this._ended = false
    this._lastHit = "none"
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

  get creatorId() {
    return this._creatorId
  }

  get name() {
    return this._name
  }

  get started() {
    return this._started
  }

  get ended() {
    return this._ended
  }

  get players() {
    return this._players
  }

  get mapAreas() {
    return this._mapAreas
  }

  /**
   * 
   * @param {string} weaponName 
   */
  setLastHit(weaponName) {
    this._lastHit = weaponName
  }

  playersIn(room) {
    return this.players.filter(player => player.room === room)
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
    } else if (this._players.length === 5) {
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
    if (this._players.length <= 1) return `not enough players to start ${this.name}`
    Weapon.randomlyAddTo(this)
    Item.randomlyAddTo(this)
    this.players.forEach(player => {
      player.randomizeLocation()
    })
    this._started = true
    return false
  }

  get info() {
    let playersString = ""
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].health === 0) playersString += "☠️ "
      playersString += `**${this.players[i].pName}**\n`
    }

    if (playersString === "") {
      playersString = "none"
    }

    return new MessageEmbed()
      .setColor("#0f0080")
      .setTitle(`${this.name} - Info`)
      .setDescription(`**Started**: ${this._started}\n` + `**Ended**: ${this._ended}`)
      .addFields(
        { name: "Players", value: playersString }
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  removePlayer(player) {
    const playerInd = this.players.indexOf(player)
    this.players.splice(playerInd, 1)
  }

  /* Ending the Game */

  get justFinished() {
    let alivePlayers = 0
    this.players.forEach(player => {
      if (player.health > 0) {
        alivePlayers++
      }
    })

    return alivePlayers <= 1
  }

  get _winner() {
    let winner = { name: "no one" }
    this.players.forEach(player => {
      if (player.health > 0) {
        winner = player
      }
    })

    return winner
  }

  get gameFinishedEmbed() {
    const winner = this._winner
    if (winner.name === "no one") {
      return new MessageEmbed()
        .setColor("#4d4d4d")
        .setTitle("Game Over")
        .setDescription("No one won")
        .setFooter("Area 0: No Survivors", bot.user.avatarURL())
    }

    const winnerItems = winner.inventory.length > 0 ? winner.inventory.map(item => item.display).join(", ") : "none"
    return new MessageEmbed()
      .setColor("#009133")
      .setTitle(`🎉 ${winner.user.username} won! 🎉`)
      .addFields(
        {
          name: "Stats", value: `Finishing Hit: ${this._lastHit}\n` +
            `Health Left: ${winner.health}`
        },
        {
          name: "Weapons", value: `Primary: ${winner.primary.name}\n` +
            `Secondary: ${winner.secondary.name}`
        },
        { name: "Items:", value: winnerItems }
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  end() {
    clearInterval(this._timeInterval)
    this._ended = true
    delete this._mapAreas // this might help with storage, since there are a lot of room objects + weapon copy objects + item copy objects
    console.log(`${this.name} has ended!`)
  }

  delete() {
    if (!this.ended) return `the game must end before you delete!`
    /* Resetting players */
    this.players.forEach(player => {
      player.reset()
    })
    this._players = []

    /* Deleting this game */
    const thisIndex = Game.all.indexOf(this)
    Game.all.splice(thisIndex, 1)
    const gameName = this.name
    const properties = Object.keys(this)
    properties.forEach(property => {
      delete this[property]
    })

    console.log(`Deleted ${gameName}`)
    return `deleted **${gameName}**`
  }

  static all = []
  static find(gameNumber) {
    const gameInd = gameNumber - 1
    if (gameInd >= Game.all.length || gameInd < 0) return false
    return Game.all[gameInd]
  }

  static get allInfo() {
    const info = new MessageEmbed()
      .setColor("#2d0080")
      .setTitle("All Games")
      .setThumbnail(bot.user.avatarURL())

    Game.all.forEach(game => {
      const started = game.started ? "Has **started**" : "Not started"
      const ended = game.ended ? " & **ended**" : ""
      const status = `Status: ${started + ended}\n`
      const winner = game.ended ? `Winner: ${game._winner.user.username}\n` : ""
      const players = game.players.map(player => player.user.username).join(", ") || "none"
      const gameInfo = status + winner + `Players: ${players}`
      info.addField(`**${game.name}**`, gameInfo)
    })

    return info
  }
}



class Player {
  /**
   * 
   * @param {*} user 
   * @param {*} channel 
   */
  constructor(user, channel) {
    this._user = user
    this._channel = channel

    this._currentGame = { name: "No Game", mapAreas: {} }
    this._location = "none"
    this._health = 100
    this._cooldowns = {
      _switch: 0,
      _movement: 0,
      _action: 0,

      _decreaseSpeed: 1,
      get switchWeapon() {
        return this._switch / this._decreaseSpeed
      },
      get movement() {
        return this._movement / this._decreaseSpeed
      },
      get action() {
        return this._action / this._decreaseSpeed
      }
    }

    this._primary = weaponFists
    this._secondary = weaponFists
    this._inventory = [
      { display: "none" },
      { display: "none" },
      { display: "none" }
    ]

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
    const weaponsString = propertiesStringify(this.availableItems.weapons, ["display"], true)
    const itemsString = propertiesStringify(this.availableItems.items, ["display"], true)
    const nearbyPlayers = this.currentGame.playersIn(this._location)
    const playersString = propertiesStringify(nearbyPlayers, ["pName"], false)
    const currentExits = this.currentExits.slice()
    if (this.currentGame.hasStairsIn(this.location)) {
      currentExits.push(`stairs: ${this._currentGame.mapAreas[this.floor][this.location].stairsTo}`)
    }
    const exitsString = currentExits.join(", ")

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
      .filter(room => room.charAt(0) === 'H')
      .filter(room => !takenLocations.includes(room))

    this._location = getRandomElementFrom(newLocations)
  }

  /* Movement */

  moveTo(room) {
    if (this._cooldowns._movement > 0) return `you have a **${this.cooldowns.movement}s** cooldown for moving!`
    if (!this.currentExits.includes(room)) return "not a current exit!"
    this._location = room

    this._cooldowns._movement = 2
    this._decreaseCooldown("_movement")
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

  _decreaseCooldown(type) {
    setTimeout(() => {
      this._cooldowns[type] -= this.cooldowns._decreaseSpeed / 2
      if (this.cooldowns[type] > 0) {
        this._decreaseCooldown(type)
      }
    }, 500)
  }

  setActionCooldown(cooldown) {
    this._cooldowns._action = cooldown

    this._decreaseCooldown("_action")
  }

  get cooldownInfo() {
    return new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`${this.user.username}'s Cooldowns`)
      .setDescription(`🏃 Movement Cooldown: ${this.cooldowns.movement}s\n` +
        `🏹 Action Cooldown: ${this.cooldowns.action}s\n` +
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

  /* Equipment Changing */

  switchWeapons() {
    if (this.cooldowns.switchWeapon > 0) return `you have a **${this.cooldowns.switchWeapon}s** cooldown for switching weapons!`

    const primaryTemp = this._primary
    this._primary = this._secondary
    this._secondary = primaryTemp
    this._cooldowns._switch = 2
    this._decreaseCooldown("_switch")
  }

  equip(weaponNumber) {
    const roomWeapons = this.currentGame.mapAreas[this.floor][this.location].weapons
    const weaponInd = weaponNumber - 1
    const roomHasWeapon = weaponInd >= 0 && weaponInd < roomWeapons.length

    if (roomHasWeapon) {
      if (this._primary.name !== "Fists") roomWeapons.push(this._primary)
      this._primary = roomWeapons[weaponInd]
      roomWeapons.splice(weaponInd, 1)
    } else {
      return `no weapon has that number`
    }
  }

  /* Items */

  use(itemNum) {
    const itemInd = itemNum - 1
    const item = this._inventory[itemInd]
    if (item.display === "none") return `you don't have an item at that slot number`
    item.use(this)
    this._inventory[itemInd] = { display: "none" }
  }

  getItem(itemNumber) {
    const roomItems = this.currentGame.mapAreas[this.floor][this.location].items
    const itemInd = itemNumber - 1
    const roomHasItem = itemInd >= 0 && itemInd < roomItems.length
    if (!roomHasItem) return `no item has that number`

    let extraSpaceInd = -1
    for (let i = 0; i < this._inventory.length && extraSpaceInd === -1; i++) {
      if (this._inventory[i].display === "none") extraSpaceInd = i
    }

    if (extraSpaceInd === -1) return `your inventory is full`
    this._inventory[extraSpaceInd] = roomItems[itemInd]
    roomItems.splice(itemInd, 1)
  }

  /* For Different Items */
  heal(amount) {
    if (this._health + amount > 100) {
      this._health = 100
    } else {
      this._health += amount
    }
  }

  setCooldownSpeed(cooldownSpeed) {
    this._cooldowns._decreaseSpeed = cooldownSpeed
  }

  get profile() {
    return new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`${this.user.username} in ${this.currentGame.name}`)
      .setThumbnail(this.user.avatarURL())
      .addFields(
        { name: "Stats", value: `**Location**: ${this._location}\n` + `**Health**: ❤️ ${this._health}` },
        { name: "Weapons", value: `**Primary**: ${this.primary.display}\n` + `**Secondary**: ${this.secondary.display}` },
        { name: "Item 1", value: this.inventory[0].display, inline: true },
        { name: "Item 2", value: this.inventory[1].display, inline: true },
        { name: "Item 3", value: this.inventory[2].display, inline: true }
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  reset() {
    this._currentGame = { name: "No Game", mapAreas: {} }
    this._location = "none"
    this._health = 100
    this._cooldowns = {
      _switch: 0,
      _movement: 0,
      _action: 0,

      _decreaseSpeed: 1,

      get switchWeapon() {
        return this._switch / this._decreaseSpeed
      },
      get movement() {
        return this._movement / this._decreaseSpeed
      },
      get action() {
        return this._action / this._decreaseSpeed
      }
    }

    this._primary = weaponFists
    this._secondary = weaponFists
    this._inventory = [
      { display: "none" },
      { display: "none" },
      { display: "none" }
    ]
  }

  /* Death Mechanics */

  /**
   * 
   * @param {string} killerName
   */
  die(killerName) {
    this._location = "Dead Room"
    this._channel.send(`${this.user.toString()}, you died!`)
    this._channel.send(this._deathMessage(killerName))
  }

  _deathMessage(killerName) {
    return new MessageEmbed()
      .setColor("#940115")
      .setTitle(`${this.user.username}`)
      .setThumbnail(this.user.avatarURL())
      .setDescription(`☠️ You were killed by **${killerName}**! ☠️`)
  }

  get deathProfile() {
    const items = this.inventory.length > 0 ? this.inventory.join(", ") : "none"
    return new MessageEmbed()
      .setColor("#940115")
      .setTitle(`${this.user.username}`)
      .setThumbnail(this.user.avatarURL())
      .setDescription("☠️ You are dead! ☠️\n\n" +
        `Location: ${this._location}\n` +
        `Weapons: ${this.primary.display} and ${this.secondary.display}\n` +
        `Items: ${items}`
      )
      .setFooter("Area 0: No Survivors", bot.user.avatarURL())
  }

  /* Static */
  static allIds = [] // contains all the playerIds
  static all = [] // contains all the players
  static remove(player) {
    const playerInd = Player.allIds.indexOf(player.user.id)
    Player.allIds.splice(playerInd, 1)
    Player.all.splice(playerInd, 1)
  }
}


/* Equipment */

class Equipment {
  /**
   * 
   * @param {string|false} icon 
   * @param {string} name 
   * @param {number} cooldown 
   * @param {number} numCopies how many of this equipment that can be added in each game
   */
  constructor(icon, name, cooldown, numCopies) {
    this._icon = icon
    this._name = name
    this._numCopies = numCopies
    this._copiesLeft = numCopies
    this._cooldown = cooldown

    // Note: this constructor does not include pushing the equipment to its designated array
  }

  get name() {
    return this._name
  }

  get display() {
    if (!this._icon) return this._name
    return `${this._icon} ${this._name}`
  }

  get cooldown() {
    return this._cooldown
  }

  static all = []
  static __chooseRandom() {
    const remainingSet = this.all.filter(equipment => equipment._copiesLeft > 0) // equipment with no more copies are removed
    if (remainingSet.length === 0) console.log("no more remaining items")
    return getRandomElementFrom(remainingSet)
  }

  static __resetAllCopies() {
    this.all.forEach(equipment => {
      equipment._copiesLeft = equipment._numCopies
    })
  }

  /* Protected: Do not use this version for actually adding items */
  /**
   * Adds a random equipment to every equipmentType room in a Game object. Use once for every game.
   * Protected: Do not use this version for actually adding items
   * @param {Game} game 
   * @param {string} equipmentType the type of equipment. Must be the exact same as the game room's property name Ex: "weapons", "items"
   */
  static _randomlyAddTo(game, equipmentType) {
    const floors = Object.keys(game.mapAreas)
    floors.forEach(floor => {
      const floorRooms = Object.keys(game.mapAreas[floor]).filter(room => Object.keys(game.mapAreas[floor][room]).includes(equipmentType))

      floorRooms.forEach(room => {
        const addedEquipment = this.__chooseRandom()
        addedEquipment._copiesLeft--

        game.mapAreas[floor][room][equipmentType].push(addedEquipment)
      })
    })

    this.__resetAllCopies() // since all equipment objects are reference, need to reset property for other games to use this method
  }
}

class Weapon extends Equipment {
  /**
   * 
   * @param {string|false} icon 
   * @param {string} name 
   * @param {number} cooldown 
   * @param {number} damage 
   * @param {number} numCopies how many of this weapon that can be added in each game
   */
  constructor(icon, name, cooldown, damage, numCopies) {
    super(icon, name, cooldown, numCopies)
    this._damage = damage

    Weapon.all.push(this) // never change the properties: each weapon is used by multiple players in multiple games
  }

  get damage() {
    return this._damage
  }

  static all = []
  /**
   * Adds a random weapon to every weapon room in a Game object. Use once for every game
   * @param {Game} game 
   */
  static randomlyAddTo(game) {
    game.mapAreas.floor1.Safe.weapons.push(weaponRifle) // guaranteed extra rifle in Safe room
    weaponRifle._copiesLeft--
    this._randomlyAddTo(game, "weapons")
  }
}

class Item extends Equipment {
  /**
   * 
   * @param {string|false} icon 
   * @param {string} name 
   * @param {number} cooldown 
   * @param {object} action
   * @param {number} numCopies how many of this equipment that can be added in each game
   */
  constructor(icon, name, cooldown, action, numCopies) {
    super(icon, name, cooldown, numCopies)
    this._action = action // function

    Item.all.push(this)
  }

  get useDescription() {
    return this._action.description
  }

  use(user) {
    this._action.use(user)
  }

  static all = []
  /**
   * Adds a random item to every items room in a Game object. Use once for every game
   * @param {Game} game 
   */
  static randomlyAddTo(game) {
    game.mapAreas.floor1.Safe.items.push(itemCoffee) // guaranteed extra coffee in Safe room
    itemCoffee._copiesLeft--
    this._randomlyAddTo(game, "items")
  }
}



// Weapons
const weaponFists = new Weapon("🤜", "Fists", 3, 13, 0)
const weaponRifle = new Weapon(false, "Rifle", 4, 33, 2)
const weaponPistol = new Weapon("🔫", "Pistol", 4, 18, 3)
const weaponDagger = new Weapon("🗡️", "Dagger", 6, 40, 3)
const weaponAxe = new Weapon("🪓", "Axe", 8, 60, 1)

// Items
const itemBandages = new Item("🩹", "Bandages", 6, {
  healAmount: 40,
  get description() { return `**heal** for ${this.healAmount} health` },

  use(user) {
    user.heal(this.healAmount)
  }
}, 10)
const itemCoffee = new Item("☕", "Coffee", 1, {
  cooldownSpeed: 2,
  duration: 5,

  get description() { return `increase **cooldown speed** to ${this.cooldownSpeed} for ${this.duration}s` },
  use(user) {
    user.setCooldownSpeed(this.cooldownSpeed)
    setTimeout(() => {
      user.setCooldownSpeed(1) // resets cooldownSpeed of player
    }, this.duration * 1000)
  }
}, 3)

// First Game
new Game()

/* Helpful Resources
documentation: https://discordjs.guide/popular-topics/embeds.html#using-the-embed-constructor
string === "" or '' // can be single or double quotes
*/
