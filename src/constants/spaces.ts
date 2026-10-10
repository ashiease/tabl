import { Space } from '../types';

export const SPACES: Space[] = [
  { id: 'barak',       name: 'Barak',       type: 'hostel',  tables: 4  },
  { id: 'brahmaputra', name: 'Brahmaputra', type: 'hostel',  tables: 4  },
  { id: 'dhansiri',    name: 'Dhansiri',    type: 'hostel',  tables: 4  },
  { id: 'dibang',      name: 'Dibang',      type: 'hostel',  tables: 4  },
  { id: 'dihing',      name: 'Dihing',      type: 'hostel',  tables: 4  },
  { id: 'disang',      name: 'Disang',      type: 'hostel',  tables: 4  },
  { id: 'kameng',      name: 'Kameng',      type: 'hostel',  tables: 4  },
  { id: 'kapili',      name: 'Kapili',      type: 'hostel',  tables: 4  },
  { id: 'library',     name: 'Library',     type: 'library', tables: 12 },
  { id: 'lohit',       name: 'Lohit',       type: 'hostel',  tables: 4  },
  { id: 'manas',       name: 'Manas',       type: 'hostel',  tables: 4  },
  { id: 'siang',       name: 'Siang',       type: 'hostel',  tables: 4  },
  { id: 'subansiri',   name: 'Subansiri',   type: 'hostel',  tables: 4  },
  { id: 'umiam',       name: 'Umiam',       type: 'hostel',  tables: 4  },
];

export const findSpace = (id: string) => SPACES.find(s => s.id === id);