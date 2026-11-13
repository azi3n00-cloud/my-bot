const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = "9008709960";
const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method, body) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("Bot actif");
  const update = req.body;

  try {
    // 1. CLICS SUR LES BOUTONS
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const msgId = cq.message.message_id;
      const data = cq.data;
      const text = cq.message.text || "";

      await tg("answerCallbackQuery", { callback_query_id: cq.id });

      if (data === "start_req") {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "📦 Envoie le nom ou le lien Amazon de ton article :",
          reply_markup: { force_reply: true },
        });
      }

      if (data.startsWith("pay|")) {
        const payment = data.split("|")[1];
        const articleLine = text.split("\n").find((l) => l.startsWith("📦 Article :")) || "";
        await tg("sendMessage", {
          chat_id: chatId,
          text: `${articleLine}\n💳 Paiement : ${payment}\n\n✏️ Ajoute un message en plus si tu le souhaites (ou écris "Non") :`,
          reply_markup: { force_reply: true },
        });
      }

      if (data === "confirm_req") {
        const user = cq.from.username ? `@${cq.from.username}` : cq.from.first_name;
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: "✅ Ta demande a bien été envoyée ! Tu seras recontacté par le bot d'ici peu.",
        });

        const summary = text.replace("\n\nVérifie tes informations et valide ta demande :", "");
        await tg("sendMessage", {
          chat_id: ADMIN_ID,
          text: `🔔 NOUVELLE DEMANDE\n👤 Client : ${user}\n🆔 Client ID: ${chatId}\n\n${summary}\n\n💡 Glisse ce message (Répondre) pour écrire au client.`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Accepter", callback_data: `adm_ok|${chatId}` },
                { text: "❌ Refuser", callback_data: `adm_no|${chatId}` },
              ],
            ],
          },
        });
      }

      if (data.startsWith("adm_")) {
        const [action, targetId] = data.split("|");
        const accepted = action === "adm_ok";
        await tg("sendMessage", {
          chat_id: targetId,
          text: accepted
            ? "✅ Ta demande a été acceptée ! Un administrateur va te contacter ici."
            : "❌ Désolé, ta demande a été refusée.",
        });
        await tg("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: `${text}\n\n📌 Statut : ${accepted ? "✅ ACCEPTÉE" : "❌ REFUSÉE"}`,
        });
      }

      return res.status(200).send("OK");
    }

    // 2. MESSAGES TEXTE
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = msg.text;
      const replyText = msg.reply_to_message ? msg.reply_to_message.text || "" : "";

      if (text === "/start") {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "👋 Bienvenue ! Clique sur le bouton ci-dessous pour faire ta demande :",
          reply_markup: {
            inline_keyboard: [[{ text: "🔍 Article à rechercher", callback_data: "start_req" }]],
          },
        });
        return res.status(200).send("OK");
      }

      if (chatId === ADMIN_ID && replyText.includes("🆔 Client ID:")) {
        const match = replyText.match(/🆔 Client ID:\s*(\d+)/);
        if (match) {
          await tg("sendMessage", {
            chat_id: match[1],
            text: `💬 Message de l'admin :\n\n${text}`,
          });
          await tg("sendMessage", { chat_id: ADMIN_ID, text: "✔️ Message envoyé au client." });
        }
        return res.status(200).send("OK");
      }

      if (replyText.startsWith("📦 Envoie le nom ou le lien Amazon")) {
        await tg("sendMessage", {
          chat_id: chatId,
          text: `📦 Article : ${text}\n\n💳 Choisis ton mode de paiement :`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "PCS", callback_data: "pay|PCS" },
                { text: "PaysafeCard", callback_data: "pay|PaysafeCard" },
              ],
              [
                { text: "CASHlib", callback_data: "pay|CASHlib" },
                { text: "Transcash", callback_data: "pay|Transcash" },
              ],
              [{ text: "Crypto", callback_data: "pay|Crypto" }],
            ],
          },
        });
        return res.status(200).send("OK");
      }

      if (replyText.includes("Ajoute un message en plus")) {
        const infos = replyText.split("\n\n")[0];
        await tg("sendMessage", {
          chat_id: chatId,
          text: `${infos}\n📝 Message : ${text}\n\nVérifie tes informations et valide ta demande :`,
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Finaliser la demande", callback_data: "confirm_req" }]],
          },
        });
        return res.status(200).send("OK");
      }

      if (chatId !== ADMIN_ID) {
        const user = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        await tg("sendMessage", {
          chat_id: ADMIN_ID,
          text: `💬 Message de ${user}\n🆔 Client ID: ${chatId}\n\n${text}`,
        });
      }
    }
  } catch (e) {
    console.error(e);
  }

  return res.status(200).send("OK");
};
