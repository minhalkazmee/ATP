// Round-robin sales team — leads are distributed in order.
// To add/remove a rep, edit this array. The round-robin counter in Supabase
// auto-wraps to the new length, so changes take effect immediately.

export interface SalesRep {
  name: string;
  firstName: string;
  email: string;
}

export const SALES_TEAM: SalesRep[] = [
  { name: 'Mitch Bihuniak',  firstName: 'Mitch',   email: 'mitch@sunhub.com'  },
  { name: 'Shoban Alee',     firstName: 'Shoban',   email: 'shoban@sunhub.com' },
  { name: 'Shoaib Younus',   firstName: 'Shoaib',   email: 'shoaib@sunhub.com' },
  { name: 'Asad Marri',      firstName: 'Asad',     email: 'asad@sunhub.com'   },
  { name: 'Sonia Majeed',    firstName: 'Sonia',    email: 'sonia@sunhub.com'  },
  { name: 'Cody Cooper',     firstName: 'Cody',     email: 'cody@sunhub.com'   },
  { name: 'Hafsa Imran',     firstName: 'Hafsa',    email: 'hafsa@sunhub.com'  },
  { name: 'Marley Kakusa',   firstName: 'Marley',   email: 'marley@sunhub.com' },
  { name: 'Neha',            firstName: 'Neha',     email: 'neha@sunhub.com'   },
  { name: 'Qasim Bhatti',    firstName: 'Qasim',    email: 'qasim@sunhub.com'  },
  { name: 'Eman Shaikh',     firstName: 'Eman',     email: 'eman@sunhub.com'   },
];
