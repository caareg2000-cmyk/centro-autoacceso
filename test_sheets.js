const { google } = require("googleapis");
const fs = require("fs");

async function test() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "credentials.json",
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const spreadsheetId = "1DjFW71SDLHzGYImRzuhjvEvycxevUXm0oZDXLCNoOjg";
    const range = "A1:B1";

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["✅ Conexión exitosa", new Date().toLocaleString()]],
      },
    });

    console.log("✅ Todo bien:", res.statusText);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

test();
