// ./executor.cjs
const { ethers } = require("ethers");
require("dotenv").config();

class FlashloanExecutor {
  constructor({ provider, wallet, arbitrageContractAddress, arbitrageABI }) {
    this.provider =
      provider ||
      new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

    this.wallet =
      wallet || new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);

    const contractAddress =
      (arbitrageContractAddress || process.env.ARB_CONTRACT_ADDRESS || "").toLowerCase();

    if (!ethers.utils.isAddress(contractAddress)) {
      throw new Error("Invalid ARB_CONTRACT_ADDRESS");
    }

    // Debug: check ABI
    console.log("📝 Creating FlashloanExecutor...");
    console.log("Contract address:", contractAddress);
    console.log("ABI type:", typeof arbitrageABI);
    console.log("ABI is array:", Array.isArray(arbitrageABI));
    if (Array.isArray(arbitrageABI)) {
      console.log("ABI length:", arbitrageABI.length);
    }

    this.contract = new ethers.Contract(
      contractAddress,
      arbitrageABI,
      this.wallet
    );

    // Debug: check available functions
    console.log("Available functions:", Object.keys(this.contract.functions));
  }

  async executeArbitrage({
    token0,
    token1,
    amountIn,      // BigNumber
    minMidOut,     // BigNumber
    routers,       // [routerA, routerB]
    path,          // [token0, token1]
    feeTier = 500, // Uniswap V3 fee tier
  }) {
    console.log(
      `🏦 Executing flashloan arbitrage: borrow ${ethers.utils.formatUnits(amountIn, this._getTokenDecimals(token0))} of ${this._getTokenName(token0)}`
    );

    const txArgs = [
      token0.toLowerCase(),
      token1.toLowerCase(),
      amountIn,
      minMidOut,
      feeTier,
      path.map(addr => addr.toLowerCase()),
      [amountIn, minMidOut],
      routers.map(addr => addr.toLowerCase()),
    ];

    console.log("📋 Transaction args:", {
      token0: txArgs[0],
      token1: txArgs[1],
      amountIn: txArgs[2].toString(),
      minMidOut: txArgs[3].toString(),
      feeTier: txArgs[4],
      path: txArgs[5],
      amounts: txArgs[6].map(a => a.toString()),
      routers: txArgs[7]
    });

    // Fetch fee data
    const feeData = await this.provider.getFeeData();
    const maxPriorityFeePerGas =
      feeData.maxPriorityFeePerGas || ethers.utils.parseUnits("30", "gwei");
    const maxFeePerGas =
      feeData.maxFeePerGas || ethers.utils.parseUnits("60", "gwei");

    // Estimate gas
    let gasLimit;
    try {
      console.log("⛽ Estimating gas...");
      const est = await this.contract.estimateGas.executeFlashLoanArbitrageInternal(...txArgs);
      gasLimit = est.mul(120).div(100); // pad by 20%
      console.log("Gas estimate:", gasLimit.toString());
    } catch (e) {
      console.warn("⚠️ Gas estimation failed, using fallback 3,000,000:", e.message);
      gasLimit = ethers.BigNumber.from(3_000_000);
    }

    // Get nonce and chainId
    const nonce = await this.provider.getTransactionCount(this.wallet.address, "latest");
    const { chainId } = await this.provider.getNetwork();

    // Populate transaction
    console.log("📝 Populating transaction...");
    const txReq = await this.contract.populateTransaction.executeFlashLoanArbitrageInternal(...txArgs);

    const fullTx = {
      ...txReq,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      nonce,
      chainId,
      type: 2,
    };

    // Sign and broadcast
    console.log("🔐 Signing transaction...");
    const signedTx = await this.wallet.signTransaction(fullTx);

    console.log("📤 Broadcasting transaction...");
    const tx = await this.provider.sendTransaction(signedTx);
    console.log("✅ Sent tx:", tx.hash);

    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait(2);
    console.log(`🎉 Confirmed in block ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

    if (receipt.status === 1) {
      console.log("✅ Transaction successful!");
    } else {
      console.log("❌ Transaction failed!");
    }

    return receipt;
  }

  // Helper methods for debugging
  _getTokenName(address) {
    const tokenMap = {
      '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'USDC',
      '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'USDT',
      '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': 'DAI',
      '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 'WETH',
      '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 'WBTC',
      '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 'WMATIC'
    };
    return tokenMap[address.toLowerCase()] || address;
  }

  _getTokenDecimals(address) {
    const decimalsMap = {
      '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 6,
      '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6,
      '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': 18,
      '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': 18,
      '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 8,
      '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 18
    };
    return decimalsMap[address.toLowerCase()] || 18;
  }

  _getRouterName(address) {
    const routerMap = {
      '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'quickswap',
      '0xe592427a0aece92de3ede1f18e0157c05861564': 'uniswapV3',
      '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'sushiswap',
      '0x546c79662e028b661dfb4767664d0273184e4dd1': 'kyberswap',
      '0xa102072a4c07f06ec3b4900fdc4c7b80b6c57429': 'dfyn',
      '0xc0788a3ad43d79aa53b09c2eacc313a787d1d607': 'apeswap'
    };
    return routerMap[address.toLowerCase()] || address;
  }
}

module.exports = FlashloanExecutor;
