const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, 'src/contracts/FreelanceEscrow.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'FreelanceEscrow.sol': {
      content: source
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode']
      }
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

console.log('Compiling contract...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  output.errors.forEach(error => {
    console.error(error.formattedMessage);
  });
  if (output.errors.some(error => error.severity === 'error')) {
    process.exit(1);
  }
}

const contract = output.contracts['FreelanceEscrow.sol']['FreelanceEscrow'];
const abi = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;

const outputContent = `export const ESCROW_ABI = ${JSON.stringify(abi, null, 2)} as const;

export const ESCROW_BYTECODE = "${bytecode}";
`;

const outputPath = path.join(__dirname, 'src/contracts/escrow-abi.ts');
fs.writeFileSync(outputPath, outputContent);

console.log('Contract compiled successfully!');
console.log('ABI and bytecode written to:', outputPath);
console.log('Bytecode length:', bytecode.length, 'characters');
