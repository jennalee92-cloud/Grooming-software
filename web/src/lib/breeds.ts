// Breed suggestions for the breed picker. Safe to import from browser components.
// Staff can still type anything (mixes, newly recognized breeds).

// AKC-recognized breeds. AKC adds a few breeds most years, so this list may
// trail the newest ones; those can be typed in.
export const AKC_BREEDS = [
  "Affenpinscher", "Afghan Hound", "Airedale Terrier", "Akita", "Alaskan Malamute",
  "American English Coonhound", "American Eskimo Dog", "American Foxhound", "American Hairless Terrier",
  "American Leopard Hound", "American Staffordshire Terrier", "American Water Spaniel", "Anatolian Shepherd Dog",
  "Australian Cattle Dog", "Australian Shepherd", "Australian Stumpy Tail Cattle Dog", "Australian Terrier", "Azawakh",
  "Barbet", "Basenji", "Basset Fauve de Bretagne", "Basset Hound", "Beagle", "Bearded Collie", "Beauceron",
  "Bedlington Terrier", "Belgian Laekenois", "Belgian Malinois", "Belgian Sheepdog", "Belgian Tervuren",
  "Bergamasco Sheepdog", "Berger Picard", "Bernese Mountain Dog", "Bichon Frise", "Biewer Terrier",
  "Black and Tan Coonhound", "Black Russian Terrier", "Bloodhound", "Bluetick Coonhound", "Boerboel", "Bolognese",
  "Border Collie", "Border Terrier", "Borzoi", "Boston Terrier", "Bouvier des Flandres", "Boxer", "Boykin Spaniel",
  "Bracco Italiano", "Briard", "Brittany", "Brussels Griffon", "Bull Terrier", "Bulldog", "Bullmastiff",
  "Cairn Terrier", "Canaan Dog", "Cane Corso", "Cardigan Welsh Corgi", "Cavalier King Charles Spaniel", "Cesky Terrier",
  "Chesapeake Bay Retriever", "Chihuahua", "Chinese Crested", "Chinese Shar-Pei", "Chinook", "Chow Chow",
  "Cirneco dell'Etna", "Clumber Spaniel", "Cocker Spaniel", "Collie", "Coton de Tulear", "Curly-Coated Retriever",
  "Dachshund", "Dalmatian", "Dandie Dinmont Terrier", "Danish-Swedish Farmdog", "Doberman Pinscher", "Dogo Argentino",
  "Dogue de Bordeaux", "English Cocker Spaniel", "English Foxhound", "English Setter", "English Springer Spaniel",
  "English Toy Spaniel", "Entlebucher Mountain Dog", "Field Spaniel", "Finnish Lapphund", "Finnish Spitz",
  "Flat-Coated Retriever", "French Bulldog", "German Pinscher", "German Shepherd Dog", "German Shorthaired Pointer",
  "German Wirehaired Pointer", "Giant Schnauzer", "Glen of Imaal Terrier", "Golden Retriever", "Gordon Setter",
  "Grand Basset Griffon Vendéen", "Great Dane", "Great Pyrenees", "Greater Swiss Mountain Dog", "Greyhound",
  "Hamiltonstovare", "Harrier", "Havanese", "Ibizan Hound", "Icelandic Sheepdog", "Irish Red and White Setter",
  "Irish Setter", "Irish Terrier", "Irish Water Spaniel", "Irish Wolfhound", "Italian Greyhound", "Japanese Chin",
  "Japanese Spitz", "Keeshond", "Kerry Blue Terrier", "Komondor", "Kuvasz", "Labrador Retriever", "Lagotto Romagnolo",
  "Lakeland Terrier", "Lancashire Heeler", "Leonberger", "Lhasa Apso", "Löwchen", "Maltese", "Manchester Terrier",
  "Mastiff", "Miniature American Shepherd", "Miniature Bull Terrier", "Miniature Pinscher", "Miniature Schnauzer",
  "Mudi", "Neapolitan Mastiff", "Nederlandse Kooikerhondje", "Newfoundland", "Norfolk Terrier", "Norrbottenspets",
  "Norwegian Buhund", "Norwegian Elkhound", "Norwegian Lundehund", "Norwich Terrier",
  "Nova Scotia Duck Tolling Retriever", "Old English Sheepdog", "Otterhound", "Papillon", "Parson Russell Terrier",
  "Pekingese", "Pembroke Welsh Corgi", "Petit Basset Griffon Vendéen", "Pharaoh Hound", "Plott Hound", "Pointer",
  "Polish Lowland Sheepdog", "Pomeranian", "Poodle (Toy)", "Poodle (Miniature)", "Poodle (Standard)",
  "Portuguese Podengo Pequeno", "Portuguese Pointer", "Portuguese Water Dog", "Pug", "Puli", "Pumi",
  "Pyrenean Shepherd", "Rat Terrier", "Redbone Coonhound", "Rhodesian Ridgeback", "Rottweiler", "Russell Terrier",
  "Russian Toy", "Saint Bernard", "Saluki", "Samoyed", "Schipperke", "Scottish Deerhound", "Scottish Terrier",
  "Sealyham Terrier", "Shetland Sheepdog", "Shiba Inu", "Shih Tzu", "Siberian Husky", "Silky Terrier", "Skye Terrier",
  "Sloughi", "Slovakian Wirehaired Pointer", "Slovensky Cuvac", "Smooth Fox Terrier", "Soft Coated Wheaten Terrier",
  "Spanish Mastiff", "Spanish Water Dog", "Spinone Italiano", "Staffordshire Bull Terrier", "Standard Schnauzer",
  "Sussex Spaniel", "Swedish Lapphund", "Swedish Vallhund", "Thai Ridgeback", "Tibetan Mastiff", "Tibetan Spaniel",
  "Tibetan Terrier", "Toy Fox Terrier", "Treeing Walker Coonhound", "Vizsla", "Weimaraner", "Welsh Springer Spaniel",
  "Welsh Terrier", "West Highland White Terrier", "Whippet", "Wire Fox Terrier", "Wirehaired Pointing Griffon",
  "Wirehaired Vizsla", "Xoloitzcuintli", "Yorkshire Terrier",
];

// Doodles that come in several sizes, each listed in every size.
const SIZED_DOODLES = [
  "Goldendoodle", "Labradoodle", "Australian Labradoodle", "Bernedoodle", "Aussiedoodle", "Sheepadoodle",
  "Golden Mountain Doodle", "Whoodle", "Bordoodle", "Irish Doodle", "Schnoodle", "Cockapoo", "Springerdoodle",
  "Boxerdoodle", "Huskydoodle",
];
const DOODLE_SIZES = ["Toy", "Mini", "Medium", "Standard"];

// Doodles that mostly come in one size.
const OTHER_DOODLES = [
  "Cavapoo", "Maltipoo", "Yorkipoo", "Shih-Poo", "Havapoo", "Pomapoo", "Peekapoo", "Westiepoo", "Poochon",
  "Chipoo", "Jackapoo", "Corgipoo", "Doxiepoo", "Pugapoo", "Bichpoo", "Lhasapoo", "Weimardoodle", "Dalmadoodle",
  "Doberdoodle", "Rottle (Rottweiler Poodle)", "Newfypoo", "Saint Berdoodle", "Great Danoodle", "Pyredoodle",
  "Double Doodle",
];

export const DOODLE_BREEDS = [
  ...SIZED_DOODLES.flatMap((name) => [name, ...DOODLE_SIZES.map((size) => `${name} (${size})`)]),
  ...OTHER_DOODLES,
].sort((a, b) => a.localeCompare(b));

export const OTHER_DOG_TYPES = ["Mixed breed", "Unknown"];

export type BreedGroup = { label: string; breeds: string[] };

export const DOG_BREED_GROUPS: BreedGroup[] = [
  { label: "Doodles and poodle mixes", breeds: DOODLE_BREEDS },
  { label: "AKC breeds", breeds: AKC_BREEDS },
  { label: "Other", breeds: OTHER_DOG_TYPES },
];
