import Electrocron from './gfx/Elements_Electrocron.svg';
import Oxotis from './gfx/Elements_Oxotis.svg';
import Lorxarim from './gfx/Elements_Lorxarim.svg';
import Donorite from './gfx/Elements_Donorite.svg';
import Zoalinzix from './gfx/Elements_Zoalinzix.svg';
import Morchranot from './gfx/Elements_Morchranot.svg';
import Olipsite from './gfx/Elements_Olipsite.svg';
import Triforklide from './gfx/Elements_Triforklide.svg';
import Narvishma from './gfx/Elements_Narvishma.svg';
import Honastrev from './gfx/Elements_Honastrev.svg';

export const COSMIC_ELEMENT_LIST = [
  {
    name: 'Electrocron',
    phonetic: `\\i-'lek-trō-krän\\`,
    color: '1f9ce0',
    type: 'Crystal',
    epc: '3000',
    hardness: '8',
    image: Electrocron,
    requiredElements: [
      'Narvishma',
      'Morchranot'
    ]
  },
  {
    name: 'Oxotis',
    phonetic: `\\äks-'ō-tis\\`,
    color: 'b7b7b7',
    type: 'Metal',
    epc: '20',
    hardness: '7',
    image: Oxotis
  },
  {
    name: 'Lorxarim',
    phonetic: `\\lòrks-'är-im\\`,
    color: 'a50047',
    type: 'Crystal',
    epc: '594',
    hardness: '6',
    image: Lorxarim
  },
  {
    name: 'Donorite',
    phonetic: `\\'dō-ner-īt\\`,
    color: '007228',
    type: 'Crystal mesh',
    epc: '749',
    hardness: '4',
    image: Donorite
  },
  {
    name: 'Zoalinzix',
    phonetic: `\\'zau̇-lin-zix\\`,
    color: 'aaff00',
    type: 'Crystal',
    epc: '1381',
    hardness: '7',
    image: Zoalinzix
  },
  {
    name: 'Morchranot',
    phonetic: `\\'mòr-kran-ät\\`,
    color: '1d003d',
    type: 'Heavily viscous liquid',
    epc: '765',
    hardness: '1',
    image: Morchranot,
    requiredElements: [
      'Honastrev',
      'Triforklide'
    ]
  },
  {
    name: 'Olipsite',
    phonetic: `\\ō-'lip-sīt\\`,
    color: 'e0d8aa',
    type: 'Smooth, translucent solid',
    epc: '-419',
    hardness: '5.5',
    image: Olipsite
  },
  {
    name: 'Triforklide',
    phonetic: `\\trī-'fòr-klīd\\`,
    color: [
      '4ecc00',
      '8341c1'
    ],
    type: 'Lightly viscous liquid',
    epc: '152',
    hardness: '0.5',
    image: Triforklide,
    requiredElements: [
      'Lorxarim',
      'Donorite'
    ]
  },
  {
    name: 'Narvishma',
    phonetic: `\\när-'vish-mə\\`,
    color: [
      'edebe1',
      'ffffff'
    ],
    type: 'Dusty, chalky compound',
    epc: '-2604',
    hardness: '2.4',
    image: Narvishma,
    requiredElements: [
      'Olipsite',
      'Oxotis'
    ]
  },
  {
    name: 'Honastrev',
    phonetic: `\\hō-'nas-trev\\`,
    color: [
      '179b00',
      '9b4b00'
    ],
    type: 'Crystal, metal-oxide composite',
    epc: '-443',
    hardness: '6',
    image: Honastrev,
    requiredElements: [
      'Oxotis',
      'Zoalinzix'
    ]
  }
];

export const COSMIC_ELEMENT_MAP = COSMIC_ELEMENT_LIST.reduce((acc, item) => {
  const {name, requiredElements = []} = item;

  acc[name] = {
    required: [...requiredElements],
    factory(...args) {
      return {
        ...item,
        components: args
      };
    }
  };

  return acc;
}, {});

export default COSMIC_ELEMENT_MAP;
