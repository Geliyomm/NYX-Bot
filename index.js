require('dotenv').config();
const express = require('express');
const { 
    Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder, 
    ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    Events, MessageFlags 
} = require('discord.js');
const Database = require('better-sqlite3');

// --- 1. WEB SUNUCUSU (Render'ı Uyanık Tutmak İçin) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('NYX-BOT 7/24 Aktif ve Çalışıyor! 🚀');
});

app.listen(port, () => {
    console.log(`📡 Web sunucusu ${port} portunda yayında.`);
});

// --- 2. VERİTABANI BAĞLANTISI ---
const db = new Database('database.sqlite');
db.prepare('CREATE TABLE IF NOT EXISTS ticket_stats (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)').run();

// --- 3. BOT İSTEMCİSİ VE INTENTLER ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- 4. AYARLAR ---
const ANA_YETKILI_ROL_ID = "1470469302892232784";    
const TICKET_YETKILI_ROL_ID = "1488156765857124383"; 

// --- 5. ETKİNLİKLER (EVENTS) ---

// Oto-Rol (Unwhitelist)
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        console.log(`🆕 Yeni üye katıldı: ${member.user.tag}`);
        const unWlRole = member.guild.roles.cache.find(r => r.name === 'Unwhitelist');
        if (unWlRole) {
            await member.roles.add(unWlRole);
        }
    } catch (e) {
        console.log("❌ Oto-rol hatası: Botun yetkisi yetersiz veya rol bulunamadı.");
    }
});

// Bot Hazır Olduğunda
client.once(Events.ClientReady, async (c) => {
    console.log(`✅ NYX SİSTEMİ ÇEVRİMİÇİ: ${c.user.tag}`);
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            await guild.commands.set([
                { name: 'kurulum', description: 'Kategorileri ve izinli rolleri kurar.' },
                { name: 'kanal-sil', description: 'Sunucudaki tüm kanalları temizler.' },
                { name: 'wl-kur', description: 'Whitelist başvuru mesajını gönderir.' },
                { name: 'ticket-kur', description: 'Gelişmiş Ticket sistemini kurar.' },
                { name: 'ticket-sayi', description: 'Kapatılan ticket sayısını gösterir.' }
            ]);
            console.log("🚀 Slash komutları başarıyla tanımlandı.");
        }
    } catch (err) {
        console.log("❌ Komut yükleme hatası:", err.message);
    }
});

// Etkileşimler (Interaction)
client.on(Events.InteractionCreate, async (interaction) => {
    
    // SLASH KOMUTLARI
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'ticket-sayi') {
            if (!interaction.member.roles.cache.has(ANA_YETKILI_ROL_ID) && !interaction.member.roles.cache.has(TICKET_YETKILI_ROL_ID)) {
                return interaction.reply({ content: "❌ Yetkiniz yok!", flags: [MessageFlags.Ephemeral] });
            }
            const row = db.prepare('SELECT count FROM ticket_stats WHERE user_id = ?').get(interaction.user.id);
            return interaction.reply({ content: `📊 Toplam kapatılan ticket: **${row ? row.count : 0}**`, flags: [MessageFlags.Ephemeral] });
        }

        if (!interaction.member.roles.cache.has(ANA_YETKILI_ROL_ID)) return interaction.reply({ content: "❌ Sadece Ana Yetkili!", flags: [MessageFlags.Ephemeral] });

        if (commandName === 'kanal-sil') {
            await interaction.reply({ content: "⚠️ Kanallar temizleniyor...", flags: [MessageFlags.Ephemeral] });
            const channels = await interaction.guild.channels.fetch();
            for (const ch of channels.values()) { try { await ch.delete(); } catch(e){} }
        }

        if (commandName === 'kurulum') {
            await interaction.reply({ content: "⏳ Sistem ve roller kuruluyor...", flags: [MessageFlags.Ephemeral] });
            
            let wlRole = interaction.guild.roles.cache.find(r => r.name === 'Whitelist') || await interaction.guild.roles.create({ name: 'Whitelist', color: 'Green' });
            let unWlRole = interaction.guild.roles.cache.find(r => r.name === 'Unwhitelist') || await interaction.guild.roles.create({ name: 'Unwhitelist', color: 'Grey' });

            const c1 = await interaction.guild.channels.create({
                name: '🚪 GİRİŞ & KAYIT',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: unWlRole.id, allow: [PermissionsBitField.Flags.ViewChannel] },
                    { id: wlRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });
            await interaction.guild.channels.create({ name: '📋-başvuru-yap', parent: c1.id, type: ChannelType.GuildText });

            const c2 = await interaction.guild.channels.create({
                name: '🆘 DESTEK SİSTEMİ',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: wlRole.id, allow: [PermissionsBitField.Flags.ViewChannel] },
                    { id: ANA_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });
            await interaction.guild.channels.create({ name: '🎫-ticket-aç', parent: c2.id, type: ChannelType.GuildText });
            await interaction.guild.channels.create({ name: '📑-başvuru-log', parent: c2.id, type: ChannelType.GuildText });

            return interaction.editReply("✅ Kurulum bitti. Roller ve kategoriler hazır.");
        }

        if (commandName === 'wl-kur') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('wl_start').setLabel('Başvuru Yap').setStyle(ButtonStyle.Success).setEmoji('📝'));
            return interaction.reply({ content: "**Whitelist başvurusu için butona tıklayın:**", components: [row] });
        }

        if (commandName === 'ticket-kur') {
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tk_menu').addOptions([{ label: 'Destek Al', value: 'd', emoji: '🎫' }]));
            return interaction.reply({ content: "**Ticket açmak için seçim yapın:**", components: [row] });
        }
    }

    // TICKET SİSTEMİ
    if (interaction.isStringSelectMenu() && interaction.customId === 'tk_menu') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const ch = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: TICKET_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ANA_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_close').setLabel('Yetkili-Kapat').setStyle(ButtonStyle.Danger));
        await ch.send({ content: `<@&${TICKET_YETKILI_ROL_ID}> <@&${ANA_YETKILI_ROL_ID}>`, components: [row] });
        return interaction.editReply(`✅ Kanal açıldı: ${ch}`);
    }

    if (interaction.isButton() && interaction.customId === 'tk_close') {
        if (!interaction.member.roles.cache.has(TICKET_YETKILI_ROL_ID) && !interaction.member.roles.cache.has(ANA_YETKILI_ROL_ID)) return;
        db.prepare('INSERT INTO ticket_stats (user_id, count) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET count = count + 1').run(interaction.user.id);
        await interaction.reply("🔒 Ticket kapatılıyor...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // WL MODAL SİSTEMİ
    if (interaction.isButton() && interaction.customId === 'wl_start') {
        const modal = new ModalBuilder().setCustomId('wl_modal').setTitle('Whitelist Formu');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ic_ad').setLabel('Ad Soyad (IC)').setStyle(TextInputStyle.Short).setRequired(true)));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'wl_modal') {
        const adVal = interaction.fields.getTextInputValue('ic_ad');
        const log = interaction.guild.channels.cache.find(c => c.name === '📑-başvuru-log');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`onay_${interaction.user.id}_${adVal}`).setLabel('Onayla').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`red_${interaction.user.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
        );
        if (log) await log.send({ content: `👤 **Başvuran:** ${interaction.user.tag}\n🆔 **IC İsim:** ${adVal}`, components: [row] });
        return interaction.reply({ content: "✅ Başvurunuz yetkililere iletildi.", flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.isButton()) {
        const p = interaction.customId.split('_');
        if (p[0] === 'onay' || p[0] === 'red') {
            const [status, uid, name] = p;
            const member = await interaction.guild.members.fetch(uid).catch(() => null);
            if (!member) return interaction.reply({ content: "Kullanıcı sunucuda bulunamadı.", flags: [MessageFlags.Ephemeral] });

            if (status === 'onay') {
                const wlR = interaction.guild.roles.cache.find(r => r.name === 'Whitelist');
                const unWlR = interaction.guild.roles.cache.find(r => r.name === 'Unwhitelist');
                
                if (wlR) await member.roles.add(wlR).catch(e => console.log("WL Rol hatası"));
                if (unWlR) await member.roles.remove(unWlR).catch(e => console.log("UnWL Rol hatası"));
                
                await member.setNickname(name).catch(e => console.log("❌ İSİM DEĞİŞMEDİ: Yetki sorunu."));
                await member.send(`🎉 Whitelist başvurunuz onaylandı! Yeni isminiz: **${name}**`).catch(() => {});
                await interaction.update({ content: `✅ **${member.user.tag}** onaylandı.`, components: [] });
            } else if (status === 'red') {
                await member.send(`❌ Whitelist başvurunuz reddedildi.`).catch(() => {});
                await interaction.update({ content: `❌ **${member.user.tag}** reddedildi.`, components: [] });
            }
        }
    }
});

// --- 6. BOTU BAŞLAT ---
client.login(process.env.TOKEN).catch(err => {
    console.error("❌ HATA: Bot giriş yapamadı. Lütfen Token ve Intent ayarlarını kontrol et!");
});
