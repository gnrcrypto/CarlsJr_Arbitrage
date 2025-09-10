// ./index.cjs
require("dotenv").config();
const { ethers } = require("ethers");
const OpportunityScanner = require("./scanner.cjs");
const config = require("./config/path-polygon.json");

async function main() {
  console.log("🚀 Live Polygon Arbitrage Bot (Production)");
  console.log("▶️ Target Contract:", process.env.ARB_CONTRACT_ADDRESS);

  const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("👜 Wallet:", wallet.address);
  console.log("🌐 RPC:", process.env.POLYGON_RPC_URL);
  console.log("=".repeat(60));

  const scanner = new OpportunityScanner(provider, config);
  scanner.start();

  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
