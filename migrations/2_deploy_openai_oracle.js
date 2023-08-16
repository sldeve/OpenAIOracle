const OpenAIOracle = artifacts.require("OpenAIOracle");

module.exports = function(deployer, network, accounts) {
    // The oracle's account, for instance, can be the second account from Ganache
    const oracleAccount = accounts[0];

    deployer.deploy(OpenAIOracle, oracleAccount);
};
