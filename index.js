require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder, 
    ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
    Events, MessageFlags 
} = require('discord.js');
const Database = require('better-sqlite3');
const express = require('express');

// --- 1. ALTYAPI ---
const app = express();
app.get('/', (req, res) => res.send('NYX-BOT Aktif! 🚀'));
app.listen(process.env.PORT || 3000);

const db = new Database('database.sqlite');
db.prepare('CREATE TABLE IF NOT EXISTS ticket_stats (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)').run();

// --- 2. BOT AYARLARI ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- 3. AYARLAR (ID'LER) ---
const ANA_YETKILI_ROL_ID = "1470469302892232784";    
const TICKET_YETKILI_ROL_ID = "1488156765857124383"; 

// --- 4. BOT HAZIR ---
client.once(Events.ClientReady, async (c) => {
    console.log(`✅ NYX SİSTEMİ ÇEVRİMİÇİ: ${c.user.tag}`);
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            await guild.commands.set([
                { name: 'kurulum', description: 'Sunucu sistemlerini kurar.' },
                { name: 'kanal-sil', description: 'Tüm kanalları siler.' },
                { name: 'wl-kur', description: 'Gelişmiş Whitelist başvuru mesajı.' },
                { name: 'ticket-kur', description: 'Kategorili Ticket sistemini kurar.' },
                { name: 'ticket-sayi', description: 'Kapatılan ticket istatistikleri.' },
                { name: 'aktif', description: 'Sunucu Aktif duyurusu.' },
                { name: 'kapali', description: 'Sunucu Kapalı duyurusu.' },
                { name: 'bakim', description: 'Sunucu Bakım duyurusu.' }
            ]);
            console.log("🚀 Tüm komutlar başarıyla senkronize edildi.");
        }
    } catch (err) { console.log("Komut yükleme hatası:", err); }
});

// --- 5. ANA ETKİLEŞİM BLOĞU ---
client.on(Events.InteractionCreate, async (interaction) => {
    const isAuth = interaction.member?.roles.cache.has(ANA_YETKILI_ROL_ID);

    // --- SLASH KOMUTLARI ---
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // TICKET SAYI KOMUTU (DÜZELTİLDİ)
        if (commandName === 'ticket-sayi') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            try {
                const row = db.prepare('SELECT count FROM ticket_stats WHERE user_id = ?').get(interaction.user.id);
                const count = row ? row.count : 0;
                return interaction.editReply({ content: `📊 Toplam kapattığınız ticket sayısı: **${count}**` });
            } catch (e) {
                return interaction.editReply({ content: "❌ İstatistikler alınırken bir hata oluştu." });
            }
        }

        // TICKET KUR KOMUTU
        if (commandName === 'ticket-kur') {
            if (!isAuth) return interaction.reply({ content: "❌ Yetkiniz yok!", flags: [MessageFlags.Ephemeral] });
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const embed = new EmbedBuilder()
                .setTitle("NYX-RP Destek Sistemi")
                .setDescription("Lütfen destek almak istediğiniz konuyu aşağıdan seçiniz.\n\n1️⃣ Oyun İçi Destek\n2️⃣ Oyun Dışı Destek\n3️⃣ Donate Satın Alım\n4️⃣ Diğer")
                .setColor(0x2B2D31);
            
            const menu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('tk_menu')
                    .setPlaceholder('Destek kategorisi seçiniz...')
                    .addOptions([
                        { label: 'Oyun İçi Destek', value: 'oyun_ici', emoji: '🎮' },
                        { label: 'Oyun Dışı Destek', value: 'oyun_disi', emoji: '💬' },
                        { label: 'Donate Satın Alım', value: 'donate', emoji: '💰' },
                        { label: 'Diğer', value: 'diger', emoji: '❓' }
                    ])
            );

            return interaction.editReply({ embeds: [embed], components: [menu] });
        }

        // DURUM KOMUTLARI
        if (['aktif', 'kapali', 'bakim'].includes(commandName)) {
            if (!isAuth) return interaction.reply({ content: "❌ Yetkiniz yok!", flags: [MessageFlags.Ephemeral] });
            let title, desc, color;
            if (commandName === 'aktif') { title = "✅ SUNUCU AKTİF"; desc = `Sunucumuz açılmıştır!\n**IP:** \`${process.env.IP_ADRESI}\``; color = 0x00FF00; }
            if (commandName === 'kapali') { title = "❌ SUNUCU KAPALI"; desc = "Sunucumuz şu an kapalıdır."; color = 0xFF0000; }
            if (commandName === 'bakim') { title = "🛠️ SUNUCU BAKIMDA"; desc = "Sunucumuz bakımdadır."; color = 0xFFAA00; }
            const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setImage(process.env.SUNUCU_RESIM || null).setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        // WL-KUR KOMUTU
        if (commandName === 'wl-kur') {
            if (!isAuth) return interaction.reply({ content: "❌ Yetkiniz yok!", flags: [MessageFlags.Ephemeral] });
            const embed = new EmbedBuilder().setTitle("NYX-RP Whitelist Başvuru").setDescription("Kayıt olmak için aşağıdaki butona tıklayıp formu doldurunuz.").setColor(0x5865F2);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('wl_start').setLabel('Başvuru Yap').setStyle(ButtonStyle.Success).setEmoji('📝'));
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // KURULUM KOMUTU
        if (commandName === 'kurulum') {
            if (!isAuth) return interaction.reply({ content: "❌ Yetkiniz yok!", flags: [MessageFlags.Ephemeral] });
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            try {
                let wlRole = interaction.guild.roles.cache.find(r => r.name === 'Whitelist') || await interaction.guild.roles.create({ name: 'Whitelist', color: 'Green' });
                let unWlRole = interaction.guild.roles.cache.find(r => r.name === 'Unwhitelist') || await interaction.guild.roles.create({ name: 'Unwhitelist', color: 'Grey' });
                const cat1 = await interaction.guild.channels.create({ name: '🚪 GİRİŞ & KAYIT', type: ChannelType.GuildCategory });
                await interaction.guild.channels.create({ name: '📋-başvuru-yap', parent: cat1.id, type: ChannelType.GuildText });
                const cat2 = await interaction.guild.channels.create({ name: '🆘 DESTEK SİSTEMİ', type: ChannelType.GuildCategory });
                await interaction.guild.channels.create({ name: '🎫-ticket-aç', parent: cat2.id, type: ChannelType.GuildText });
                await interaction.guild.channels.create({ name: '📑-başvuru-log', parent: cat2.id, type: ChannelType.GuildText });
                return interaction.editReply("✅ Sistem başarıyla kuruldu.");
            } catch (e) { return interaction.editReply("❌ Kurulum sırasında bir hata oluştu."); }
        }
    }

    // --- TICKET MENÜ SEÇİMİ ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'tk_menu') {
        const category = interaction.values[0];
        let categoryName = category === 'oyun_ici' ? "Oyun İçi" : category === 'oyun_disi' ? "Oyun Dışı" : category === 'donate' ? "Donate" : "Diğer";

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        try {
            const ch = await interaction.guild.channels.create({
                name: `${categoryName.toLowerCase().replace(" ", "-")}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: TICKET_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: ANA_YETKILI_ROL_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tk_close').setLabel('Kapat').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
            const embed = new EmbedBuilder().setTitle(`Destek: ${categoryName}`).setDescription(`Hoş geldin <@${interaction.user.id}>\nKategori: **${categoryName}**\nYetkililer birazdan burada olacaktır.`).setColor(0x00FF00).setTimestamp();

            await ch.send({ content: `<@&${TICKET_YETKILI_ROL_ID}> | <@${interaction.user.id}>`, embeds: [embed], components: [row] });
            return interaction.editReply(`✅ Destek kanalınız oluşturuldu: ${ch}`);
        } catch (e) { return interaction.editReply("❌ Kanal oluşturulurken bir hata oluştu."); }
    }

    // --- TICKET KAPATMA ---
    if (interaction.isButton() && interaction.customId === 'tk_close') {
        if (!interaction.member.roles.cache.has(TICKET_YETKILI_ROL_ID) && !interaction.member.roles.cache.has(ANA_YETKILI_ROL_ID)) {
            return interaction.reply({ content: "❌ Bunu sadece yetkililer yapabilir!", flags: [MessageFlags.Ephemeral] });
        }
        db.prepare('INSERT INTO ticket_stats (user_id, count) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET count = count + 1').run(interaction.user.id);
        await interaction.reply("🔒 Kanal 5 saniye içinde siliniyor...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // --- WHITELIST MODAL ---
    if (interaction.isButton() && interaction.customId === 'wl_start') {
        const modal = new ModalBuilder().setCustomId('wl_modal').setTitle('NYX-RP Başvuru Formu');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ic_ad').setLabel('Karakter Ad Soyad').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yas').setLabel('OOC Yaş').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('saat').setLabel('FiveM Saati').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hikaye').setLabel('Karakter Hikayesi').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'wl_modal') {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const icAd = interaction.fields.getTextInputValue('ic_ad');
        const log = interaction.guild.channels.cache.find(c => c.name === '📑-başvuru-log');
        
        const embed = new EmbedBuilder().setTitle("Yeni Başvuru").setColor(0xFEE75C)
            .addFields(
                { name: "👤 Başvuran", value: `<@${interaction.user.id}>` },
                { name: "🆔 IC İsim", value: icAd },
                { name: "🎂 Yaş", value: interaction.fields.getTextInputValue('yas') },
                { name: "🎮 Saat", value: interaction.fields.getTextInputValue('saat') },
                { name: "📖 Hikaye", value: interaction.fields.getTextInputValue('hikaye') }
            ).setTimestamp();

        const btns = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`onay_${interaction.user.id}_${icAd}`).setLabel('Onayla').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`red_${interaction.user.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
        );

        if (log) {
            await log.send({ embeds: [embed], components: [btns] });
            return interaction.editReply("✅ Başvurunuz yetkililere iletildi.");
        } else {
            return interaction.editReply("❌ Başvuru kanalı bulunamadı. Lütfen `/kurulum` yapın.");
        }
    }

    // --- ONAY / RED İŞLEMLERİ ---
    if (interaction.isButton() && (interaction.customId.startsWith('onay_') || interaction.customId.startsWith('red_'))) {
        if (!isAuth) return interaction.reply({ content: "❌ Yetkiniz yok!", flags: [MessageFlags.Ephemeral] });
        
        const [action, uid, charName] = interaction.customId.split('_');
        const member = await interaction.guild.members.fetch(uid).catch(() => null);

        if (action === 'onay' && member) {
            const wl = interaction.guild.roles.cache.find(r => r.name === 'Whitelist');
            const unWl = interaction.guild.roles.cache.find(r => r.name === 'Unwhitelist');
            if (wl) await member.roles.add(wl);
            if (unWl) await member.roles.remove(unWl);
            await member.setNickname(charName).catch(() => {});
            await interaction.update({ content: `✅ <@${uid}> onaylandı.`, embeds: [], components: [] });
        } else {
            await interaction.update({ content: `❌ İşlem tamamlandı (Reddedildi veya Üye bulunamadı).`, embeds: [], components: [] });
        }
    }
});

client.login(process.env.TOKEN);
