const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const http = require("http");

// =====================================================
// SERVIDOR HTTP PARA RENDER
// =====================================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("🤖 NexBot está funcionando correctamente.");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor web activo en el puerto ${PORT}`);
});

// =====================================================
// NEXBOT
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const PREFIX = ">";

const DATA_FILE = path.join(__dirname, "nexbot-data.json");

// =====================================================
// BASE DE DATOS
// =====================================================

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

let db = {};

try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
  db = {};
}

function saveDB() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(db, null, 2)
  );
}

function getGuild(guildId) {
  if (!db[guildId]) {
    db[guildId] = {
      permissions: {
        roles: []
      },

      tickets: {
        category: null,
        logChannel: null,
        panelChannel: null,
        panelMessage: null
      },

      openTickets: {}
    };

    saveDB();
  }

  return db[guildId];
}

// =====================================================
// CLIENTE
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],

  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.User
  ]
});

// =====================================================
// COLORES
// =====================================================

const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  danger: 0xed4245,
  warning: 0xfee75c,
  dark: 0x18191c
};

// =====================================================
// EMBED
// =====================================================

function embed(title, description, color = COLORS.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`✦ ${title}`)
    .setDescription(description)
    .setFooter({
      text: "NexBot"
    })
    .setTimestamp();
}

// =====================================================
// ADMIN
// =====================================================

function isAdmin(member) {
  return member?.permissions?.has(
    PermissionFlagsBits.Administrator
  );
}

// =====================================================
// PERMISOS POR ROL
// =====================================================

function hasNexPermission(member) {
  if (!member) return false;

  if (isAdmin(member)) return true;

  const guild = getGuild(member.guild.id);

  return member.roles.cache.some(role =>
    guild.permissions.roles.includes(role.id)
  );
}

// =====================================================
// PANEL ADMIN
// =====================================================

function adminPanel() {

  const e = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("✦ NexBot • Administración")
    .setDescription(
      "Bienvenido al panel de administración de **NexBot**.\n\n" +
      "Selecciona una sección:"
    )
    .addFields(
      {
        name: "🔐 Permisos",
        value: "Gestionar roles autorizados."
      },
      {
        name: "🎫 Tickets",
        value: "Configurar el sistema de tickets."
      },
      {
        name: "⚙️ Configuración",
        value: "Configuración general del bot."
      }
    );

  const row = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("admin_perms")
      .setLabel("Permisos")
      .setEmoji("🔐")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_tickets")
      .setLabel("Tickets")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_settings")
      .setLabel("Configuración")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary)

  );

  return {
    embeds: [e],
    components: [row]
  };
}

// =====================================================
// PANEL DE TICKETS
// =====================================================

function ticketPanel() {

  const e = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("✦ NexBot • Tickets")
    .setDescription(
      "¿Necesitas ayuda?\n\n" +
      "Selecciona el motivo de tu ticket en el menú inferior."
    )
    .addFields({
      name: "📌 Información",
      value:
        "Abre únicamente un ticket cuando sea necesario."
    })
    .setFooter({
      text: "NexBot • Sistema de Tickets"
    });

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket_create")
    .setPlaceholder("Selecciona una categoría...")

    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Soporte")
        .setDescription("Necesito ayuda")
        .setEmoji("🛠️")
        .setValue("soporte"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Reporte")
        .setDescription("Reportar a un usuario")
        .setEmoji("🚨")
        .setValue("reporte"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Duda")
        .setDescription("Tengo una pregunta")
        .setEmoji("❓")
        .setValue("duda"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Bug")
        .setDescription("Reportar un error")
        .setEmoji("🐛")
        .setValue("bug"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Otros")
        .setDescription("Otro asunto")
        .setEmoji("📩")
        .setValue("otros")
    );

  return {
    embeds: [e],
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  };
}

// =====================================================
// PANEL DE CONFIGURACIÓN DE TICKETS
// =====================================================

function ticketAdminPanel(guild) {

  const data = getGuild(guild.id);

  const category = data.tickets.category
    ? `<#${data.tickets.category}>`
    : "No configurada";

  const logs = data.tickets.logChannel
    ? `<#${data.tickets.logChannel}>`
    : "No configurado";

  const panel = data.tickets.panelChannel
    ? `<#${data.tickets.panelChannel}>`
    : "No configurado";

  const e = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("✦ NexBot • Configuración de Tickets")
    .setDescription(
      "Configura el sistema de tickets desde aquí."
    )
    .addFields(
      {
        name: "📁 Categoría",
        value: category,
        inline: true
      },
      {
        name: "📜 Logs",
        value: logs,
        inline: true
      },
      {
        name: "🎫 Panel",
        value: panel,
        inline: true
      }
    );

  const row1 = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("ticket_create_category")
      .setLabel("Crear categoría")
      .setEmoji("📁")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("ticket_create_logs")
      .setLabel("Crear logs")
      .setEmoji("📜")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_send_panel")
      .setLabel("Enviar panel")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Success)

  );

  const row2 = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("ticket_back_admin")
      .setLabel("Volver")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Secondary)

  );

  return {
    embeds: [e],
    components: [row1, row2]
  };
}

// =====================================================
// CREAR CATEGORÍA
// =====================================================

async function createTicketCategory(guild) {

  const data = getGuild(guild.id);

  if (data.tickets.category) {
    const old = guild.channels.cache.get(
      data.tickets.category
    );

    if (old) {
      return old;
    }
  }

  const category = await guild.channels.create({
    name: "🎫・TICKETS",
    type: ChannelType.GuildCategory
  });

  data.tickets.category = category.id;

  saveDB();

  return category;
}

// =====================================================
// CREAR CANAL DE LOGS
// =====================================================

async function createTicketLogs(guild) {

  const data = getGuild(guild.id);

  if (data.tickets.logChannel) {
    const old = guild.channels.cache.get(
      data.tickets.logChannel
    );

    if (old) {
      return old;
    }
  }

  const channel = await guild.channels.create({
    name: "📜・ticket-logs",
    type: ChannelType.GuildText
  });

  data.tickets.logChannel = channel.id;

  saveDB();

  return channel;
}

// =====================================================
// CREAR TICKET
// =====================================================

async function createTicket(interaction, type) {

  const guild = interaction.guild;
  const member = interaction.member;

  const data = getGuild(guild.id);

  if (data.openTickets[member.id]) {

    const existing = guild.channels.cache.get(
      data.openTickets[member.id]
    );

    if (existing) {
      return interaction.reply({
        content:
          `❌ Ya tienes un ticket abierto: ${existing}`,
        ephemeral: true
      });
    }

    delete data.openTickets[member.id];
    saveDB();
  }

  const category =
    data.tickets.category
      ? guild.channels.cache.get(
          data.tickets.category
        )
      : await createTicketCategory(guild);

  const safeName =
    member.user.username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .slice(0, 20);

  const channel = await guild.channels.create({

    name: `ticket-${safeName}`,

    type: ChannelType.GuildText,

    parent: category.id,

    permissionOverwrites: [

      {
        id: guild.id,

        deny: [
          PermissionFlagsBits.ViewChannel
        ]
      },

      {
        id: member.id,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      },

      {
        id: client.user.id,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ]
  });

  data.openTickets[member.id] = channel.id;

  saveDB();

  const e = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("✦ NexBot • Ticket")
    .setDescription(
      `Hola ${member} 👋\n\n` +
      `Tu ticket ha sido creado correctamente.\n\n` +
      `**Categoría:** ${type}\n\n` +
      "Explica tu problema y espera a que el equipo te atienda."
    )
    .setFooter({
      text: "NexBot • Sistema de Tickets"
    });

  const row = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Cerrar ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)

  );

  await channel.send({
    content: `${member}`,
    embeds: [e],
    components: [row]
  });

  await interaction.reply({
    content:
      `✅ Ticket creado correctamente: ${channel}`,
    ephemeral: true
  });
}

// =====================================================
// CERRAR TICKET
// =====================================================

async function closeTicket(interaction) {

  const channel = interaction.channel;

  const guild = interaction.guild;
  const data = getGuild(guild.id);

  const ownerId = Object.keys(
    data.openTickets
  ).find(
    id => data.openTickets[id] === channel.id
  );

  if (!ownerId) {
    return interaction.reply({
      content:
        "❌ Este canal no parece ser un ticket de NexBot.",
      ephemeral: true
    });
  }

  if (
    interaction.user.id !== ownerId &&
    !isAdmin(interaction.member) &&
    !hasNexPermission(interaction.member)
  ) {
    return interaction.reply({
      content:
        "❌ No tienes permisos para cerrar este ticket.",
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("ticket_confirm_close")
      .setLabel("Confirmar cierre")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("ticket_cancel_close")
      .setLabel("Cancelar")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Secondary)

  );

  return interaction.reply({
    embeds: [
      embed(
        "Cerrar ticket",
        "¿Seguro que quieres cerrar este ticket?\n\n" +
        "Después del cierre podrás valorar la atención recibida."
      )
    ],
    components: [row],
    ephemeral: true
  });
}

// =====================================================
// CERRAR Y PEDIR VALORACIÓN
// =====================================================

async function confirmClose(interaction) {

  const channel = interaction.channel;
  const guild = interaction.guild;

  const data = getGuild(guild.id);

  const ownerId = Object.keys(
    data.openTickets
  ).find(
    id => data.openTickets[id] === channel.id
  );

  if (!ownerId) {
    return interaction.reply({
      content: "❌ Ticket no encontrado.",
      ephemeral: true
    });
  }

  const ratingRow = new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId("rating_1")
      .setLabel("1")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("rating_2")
      .setLabel("2")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("rating_3")
      .setLabel("3")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("rating_4")
      .setLabel("4")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("rating_5")
      .setLabel("5")
      .setEmoji("⭐")
      .setStyle(ButtonStyle.Secondary)

  );

  await interaction.update({
    embeds: [
      embed(
        "Valoración",
        "Antes de cerrar el ticket, valora la atención recibida del **1 al 5**."
      )
    ],
    components: [ratingRow]
  });
}

// =====================================================
// VALORACIÓN
// =====================================================

async function rateTicket(interaction, rating) {

  const guild = interaction.guild;
  const channel = interaction.channel;

  const data = getGuild(guild.id);

  const ownerId = Object.keys(
    data.openTickets
  ).find(
    id => data.openTickets[id] === channel.id
  );

  if (!ownerId) {
    return interaction.reply({
      content:
        "❌ No se encontró el propietario del ticket.",
      ephemeral: true
    });
  }

  const logChannel =
    data.tickets.logChannel
      ? guild.channels.cache.get(
          data.tickets.logChannel
        )
      : null;

  const owner =
    await client.users.fetch(ownerId)
      .catch(() => null);

  if (logChannel) {

    const logEmbed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("✦ NexBot • Ticket cerrado")
      .addFields(
        {
          name: "👤 Usuario",
          value: owner
            ? `${owner} (${owner.tag})`
            : ownerId
        },
        {
          name: "📁 Ticket",
          value: channel.name
        },
        {
          name: "⭐ Valoración",
          value: `${"⭐".repeat(rating)} (${rating}/5)`
        },
        {
          name: "👮 Cerrado por",
          value: `${interaction.user}`
        }
      )
      .setTimestamp();

    await logChannel.send({
      embeds: [logEmbed]
    }).catch(() => {});
  }

  delete data.openTickets[ownerId];

  saveDB();

  await interaction.update({
    embeds: [
      embed(
        "Ticket cerrado",
        `Gracias por valorar la atención con **${rating}/5 ⭐**.\n\n` +
        "Este ticket será eliminado en unos segundos.",
        COLORS.success
      )
    ],
    components: []
  });

  setTimeout(async () => {

    await channel.delete(
      "Ticket cerrado por NexBot"
    ).catch(() => {});

  }, 5000);
}

// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

  new SlashCommandBuilder()
    .setName("admin")
    .setDescription(
      "Abre el panel de administración"
    ),

  new SlashCommandBuilder()
    .setName("perms")
    .setDescription(
      "Gestiona los permisos de NexBot"
    )
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription(
          "Autoriza un rol"
        )
        .addRoleOption(opt =>
          opt
            .setName("rol")
            .setDescription(
              "Rol que quieres autorizar"
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription(
          "Quita un rol autorizado"
        )
        .addRoleOption(opt =>
          opt
            .setName("rol")
            .setDescription(
              "Rol que quieres quitar"
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription(
          "Lista los roles autorizados"
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("reset")
        .setDescription(
          "Elimina todos los roles autorizados"
        )
    ),

  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription(
      "Envía el panel de tickets"
    )

].map(command => command.toJSON());

// =====================================================
// REGISTRAR SLASH
// =====================================================

async function registerCommands() {

  if (!TOKEN || !CLIENT_ID) {
    console.log(
      "⚠️ Falta DISCORD_TOKEN o CLIENT_ID."
    );
    return;
  }

  try {

    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(
      "✅ Slash commands registrados."
    );

  } catch (error) {

    console.error(
      "❌ Error registrando comandos:",
      error
    );
  }
}

// =====================================================
// READY
// =====================================================

client.once("ready", async () => {

  console.log(
    "========================================"
  );

  console.log(
    "✦ NEXBOT"
  );

  console.log(
    `🤖 ${client.user.tag}`
  );

  console.log(
    `🌐 ${client.guilds.cache.size} servidores`
  );

  console.log(
    "========================================"
  );

  client.user.setPresence({
    activities: [
      {
        name: "NexBot • /admin",
        type: 3
      }
    ],
    status: "online"
  });

  await registerCommands();
});

// =====================================================
// INTERACCIONES
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // =================================================
      // SLASH
      // =================================================

      if (interaction.isChatInputCommand()) {

        // -----------------------------------------------
        // ADMIN
        // -----------------------------------------------

        if (
          interaction.commandName === "admin"
        ) {

          if (!isAdmin(interaction.member)) {

            return interaction.reply({
              embeds: [
                embed(
                  "Acceso denegado",
                  "❌ Necesitas el permiso **Administrador**.",
                  COLORS.danger
                )
              ],
              ephemeral: true
            });
          }

          return interaction.reply({
            ...adminPanel(),
            ephemeral: true
          });
        }

        // -----------------------------------------------
        // PERMS
        // -----------------------------------------------

        if (
          interaction.commandName === "perms"
        ) {

          if (!isAdmin(interaction.member)) {

            return interaction.reply({
              content:
                "❌ Solo los administradores pueden modificar permisos.",
              ephemeral: true
            });
          }

          const data =
            getGuild(interaction.guild.id);

          const sub =
            interaction.options.getSubcommand();

          if (sub === "add") {

            const role =
              interaction.options.getRole("rol");

            if (
              data.permissions.roles.includes(
                role.id
              )
            ) {
              return interaction.reply({
                content:
                  `⚠️ ${role} ya está autorizado.`,
                ephemeral: true
              });
            }

            data.permissions.roles.push(
              role.id
            );

            saveDB();

            return interaction.reply({
              embeds: [
                embed(
                  "Permiso añadido",
                  `✅ ${role} ahora puede utilizar las funciones autorizadas de NexBot.`,
                  COLORS.success
                )
              ],
              ephemeral: true
            });
          }

          if (sub === "remove") {

            const role =
              interaction.options.getRole("rol");

            const index =
              data.permissions.roles.indexOf(
                role.id
              );

            if (index === -1) {

              return interaction.reply({
                content:
                  `⚠️ ${role} no está autorizado.`,
                ephemeral: true
              });
            }

            data.permissions.roles.splice(
              index,
              1
            );

            saveDB();

            return interaction.reply({
              embeds: [
                embed(
                  "Permiso eliminado",
                  `✅ ${role} ya no está autorizado.`,
                  COLORS.success
                )
              ],
              ephemeral: true
            });
          }

          if (sub === "list") {

            if (
              data.permissions.roles.length === 0
            ) {

              return interaction.reply({
                embeds: [
                  embed(
                    "Permisos",
                    "No hay roles autorizados actualmente.",
                    COLORS.warning
                  )
                ],
                ephemeral: true
              });
            }

            const roles =
              data.permissions.roles
                .map(id => {

                  const role =
                    interaction.guild.roles.cache.get(
                      id
                    );

                  return role
                    ? `• ${role}`
                    : `• Rol eliminado (${id})`;

                })
                .join("\n");

            return interaction.reply({
              embeds: [
                embed(
                  "Roles autorizados",
                  roles
                )
              ],
              ephemeral: true
            });
          }

          if (sub === "reset") {

            data.permissions.roles = [];

            saveDB();

            return interaction.reply({
              embeds: [
                embed(
                  "Permisos restablecidos",
                  "✅ Se eliminaron todos los roles autorizados.",
                  COLORS.success
                )
              ],
              ephemeral: true
            });
          }
        }

        // -----------------------------------------------
        // TICKET PANEL
        // -----------------------------------------------

        if (
          interaction.commandName ===
          "ticket-panel"
        ) {

          if (!isAdmin(interaction.member)) {

            return interaction.reply({
              content:
                "❌ Solo un administrador puede enviar el panel.",
              ephemeral: true
            });
          }

          return interaction.channel.send(
            ticketPanel()
          ).then(() => {

            interaction.reply({
              content:
                "✅ Panel de tickets enviado.",
              ephemeral: true
            });

          });
        }
      }

      // =================================================
      // SELECT MENU
      // =================================================

      if (
        interaction.isStringSelectMenu()
      ) {

        if (
          interaction.customId ===
          "ticket_create"
        ) {

          const type =
            interaction.values[0];

          return createTicket(
            interaction,
            type
          );
        }
      }

      // =================================================
      // BOTONES
      // =================================================

      if (interaction.isButton()) {

        // -----------------------------------------------
        // ADMIN PERMS
        // -----------------------------------------------

        if (
          interaction.customId ===
          "admin_perms"
        ) {

          if (!isAdmin(interaction.member)) {
            return interaction.reply({
              content:
                "❌ No tienes permisos.",
              ephemeral: true
            });
          }

          const data =
            getGuild(interaction.guild.id);

          const roles =
            data.permissions.roles.length
              ? data.permissions.roles
                  .map(id => {
                    const role =
                      interaction.guild.roles.cache.get(
                        id
                      );

                    return role
                      ? `• ${role}`
                      : `• Rol eliminado`;
                  })
                  .join("\n")
              : "Ningún rol autorizado.";

          return interaction.update({

            embeds: [
              embed(
                "NexBot • Permisos",
                `### 🔐 Roles autorizados\n${roles}\n\n` +
                "**Comandos:**\n" +
                "`/perms add @rol`\n" +
                "`/perms remove @rol`\n" +
                "`/perms list`\n" +
                "`/perms reset`"
              )
            ],

            components: [

              new ActionRowBuilder().addComponents(

                new ButtonBuilder()
                  .setCustomId("admin_back")
                  .setLabel("Volver")
                  .setEmoji("↩️")
                  .setStyle(
                    ButtonStyle.Secondary
                  )

              )

            ]

          });
        }

        // -----------------------------------------------
        // ADMIN TICKETS
        // -----------------------------------------------

        if (
          interaction.customId ===
          "admin_tickets"
        ) {

          if (!isAdmin(interaction.member)) {
            return interaction.reply({
              content:
                "❌ No tienes permisos.",
              ephemeral: true
            });
          }

          return interaction.update(
            ticketAdminPanel(
              interaction.guild
            )
          );
        }

        // -----------------------------------------------
        // ADMIN SETTINGS
        // -----------------------------------------------

        if (
          interaction.customId ===
          "admin_settings"
        ) {

          return interaction.update({

            embeds: [
              embed(
                "NexBot • Configuración",
                "⚙️ Esta sección se irá ampliando con los sistemas del bot."
              )
            ],

            components: [

              new ActionRowBuilder().addComponents(

                new ButtonBuilder()
                  .setCustomId("admin_back")
                  .setLabel("Volver")
                  .setEmoji("↩️")
                  .setStyle(
                    ButtonStyle.Secondary
                  )

              )

            ]

          });
        }

        // -----------------------------------------------
        // VOLVER
        // -----------------------------------------------

        if (
          interaction.customId ===
          "admin_back"
        ) {

          return interaction.update(
            adminPanel()
          );
        }

        // -----------------------------------------------
        // CREAR CATEGORÍA
        // -----------------------------------------------

        if (
          interaction.customId ===
          "ticket_create_category"
        ) {

          await createTicketCategory(
            interaction.guild
          );

          return interaction.update(
            ticketAdminPanel(
              interaction.guild
            )
          );
        }

        // -----------------------------------------------
        // CREAR LOGS
        // -----------------------------------------------

        if (
          interaction.customId ===
          "ticket_create_logs"
        ) {

          await createTicketLogs(
            interaction.guild
          );

          return interaction.update(
            ticketAdminPanel(
              interaction.guild
            )
          );
        }

        // -----------------------------------------------
        // ENVIAR PANEL
        // -----------------------------------------------

        if (
          interaction.customId ===
          "ticket_send_panel"
        ) {

          await interaction.channel.send(
            ticketPanel()
          );

          return interaction.reply({
            content:
              "✅ Panel de tickets enviado correctamente.",
            ephemeral: true
          });
        }

        // -----------------------------------------------
        // CERRAR
        // -----------------------------------------------

        if (
          interaction.customId ===
          "ticket_close"
        ) {

          return closeTicket(
            interaction
          );
        }

        // -----------------------------------------------
        // CONFIRMAR CIERRE
        // -----------------------------------------------

        if (
          interaction.customId ===
          "ticket_confirm_close"
        ) {

          return confirmClose(
            interaction
          );
        }

        // -----------------------------------------------
        // CANCELAR
        // -----------------------------------------------

        if (
          interaction.customId ===
          "ticket_cancel_close"
        ) {

          return interaction.update({
            embeds: [
              embed(
                "Cierre cancelado",
                "El ticket seguirá abierto.",
                COLORS.success
              )
            ],
            components: []
          });
        }

        // -----------------------------------------------
        // VALORACIÓN
        // -----------------------------------------------

        if (
          interaction.customId.startsWith(
            "rating_"
          )
        ) {

          const rating = Number(
            interaction.customId.split("_")[1]
          );

          return rateTicket(
            interaction,
            rating
          );
        }
      }

    } catch (error) {

      console.error(
        "❌ Error en interacción:",
        error
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({
          content:
            "❌ Ocurrió un error.",
          ephemeral: true
        }).catch(() => {});

      } else {

        await interaction.reply({
          content:
            "❌ Ocurrió un error.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

// =====================================================
// PREFIX
// =====================================================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) return;
    if (!message.guild) return;

    if (
      !message.content.startsWith(PREFIX)
    ) {
      return;
    }

    const args =
      message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const command =
      args.shift()?.toLowerCase();

    // =================================================
    // >ADMIN
    // =================================================

    if (command === "admin") {

      if (!isAdmin(message.member)) {

        return message.reply({
          embeds: [
            embed(
              "Acceso denegado",
              "❌ Necesitas el permiso **Administrador**.",
              COLORS.danger
            )
          ]
        });
      }

      return message.reply(
        adminPanel()
      );
    }

    // =================================================
    // >PERMS
    // =================================================

    if (command === "perms") {

      if (!isAdmin(message.member)) {

        return message.reply({
          content:
            "❌ Solo administradores."
        });
      }

      const data =
        getGuild(message.guild.id);

      const action =
        args.shift()?.toLowerCase();

      // >perms @rol

      if (!action) {

        const role =
          message.mentions.roles.first();

        if (!role) {

          return message.reply({
            content:
              "Uso: `>perms @rol`"
          });
        }

        if (
          data.permissions.roles.includes(
            role.id
          )
        ) {

          return message.reply({
            content:
              `⚠️ ${role} ya está autorizado.`
          });
        }

        data.permissions.roles.push(
          role.id
        );

        saveDB();

        return message.reply({
          embeds: [
            embed(
              "Permiso añadido",
              `✅ ${role} ahora está autorizado.`,
              COLORS.success
            )
          ]
        });
      }

      // >perms remove @rol

      if (action === "remove") {

        const role =
          message.mentions.roles.first();

        if (!role) {

          return message.reply({
            content:
              "❌ Debes mencionar un rol."
          });
        }

        const index =
          data.permissions.roles.indexOf(
            role.id
          );

        if (index === -1) {

          return message.reply({
            content:
              `⚠️ ${role} no está autorizado.`
          });
        }

        data.permissions.roles.splice(
          index,
          1
        );

        saveDB();

        return message.reply({
          embeds: [
            embed(
              "Permiso eliminado",
              `✅ ${role} ya no está autorizado.`,
              COLORS.success
            )
          ]
        });
      }

      // >perms list

      if (action === "list") {

        const roles =
          data.permissions.roles
            .map(id => {

              const role =
                message.guild.roles.cache.get(
                  id
                );

              return role
                ? `• ${role}`
                : "• Rol eliminado";

            })
            .join("\n");

        return message.reply({
          embeds: [
            embed(
              "Roles autorizados",
              roles || "Ninguno."
            )
          ]
        });
      }

      // >perms reset

      if (action === "reset") {

        data.permissions.roles = [];

        saveDB();

        return message.reply({
          embeds: [
            embed(
              "Permisos restablecidos",
              "✅ Todos los roles autorizados fueron eliminados.",
              COLORS.success
            )
          ]
        });
      }
    }

    // =================================================
    // >TICKET-PANEL
    // =================================================

    if (
      command === "ticket-panel"
    ) {

      if (!isAdmin(message.member)) {

        return message.reply({
          content:
            "❌ Solo administradores."
        });
      }

      await message.channel.send(
        ticketPanel()
      );

      return message.reply({
        content:
          "✅ Panel enviado."
      });
    }
  }
);

// =====================================================
// ERRORES
// =====================================================

client.on("error", error => {
  console.error(
    "❌ Discord:",
    error
  );
});

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

// =====================================================
// LOGIN
// =====================================================

if (!TOKEN) {

  console.error(
    "❌ Falta DISCORD_TOKEN en las variables de entorno."
  );

  process.exit(1);
}

client.login(TOKEN);
