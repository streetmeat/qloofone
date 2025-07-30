export interface TestEntity {
  query: string;
  expectedId?: string;
  expectedName?: string;
  type: string;
}

// Large diverse entity pools to avoid cache dependency
export const TEST_ENTITIES = {
  movie: [
    // Popular movies
    { query: "The Matrix", type: "urn:entity:movie" },
    { query: "Inception", type: "urn:entity:movie" },
    { query: "The Godfather", type: "urn:entity:movie" },
    { query: "Pulp Fiction", type: "urn:entity:movie" },
    { query: "The Dark Knight", type: "urn:entity:movie" },
    { query: "Parasite", type: "urn:entity:movie" },
    { query: "Interstellar", type: "urn:entity:movie" },
    { query: "Fight Club", type: "urn:entity:movie" },
    { query: "The Shawshank Redemption", type: "urn:entity:movie" },
    { query: "Forrest Gump", type: "urn:entity:movie" },
    // International films
    { query: "Amélie", type: "urn:entity:movie" },
    { query: "Seven Samurai", type: "urn:entity:movie" },
    { query: "City of God", type: "urn:entity:movie" },
    { query: "Spirited Away", type: "urn:entity:movie" },
    // Recent films
    { query: "Everything Everywhere All at Once", type: "urn:entity:movie" },
    { query: "Dune 2021", type: "urn:entity:movie" },
    { query: "Top Gun Maverick", type: "urn:entity:movie" },
    { query: "The Batman 2022", type: "urn:entity:movie" },
    // Classic films
    { query: "Casablanca", type: "urn:entity:movie" },
    { query: "Citizen Kane", type: "urn:entity:movie" }
  ],

  music: [
    // Various genres
    { query: "The Beatles", type: "urn:entity:artist" },
    { query: "Taylor Swift", type: "urn:entity:artist" },
    { query: "Radiohead", type: "urn:entity:artist" },
    { query: "Beyoncé", type: "urn:entity:artist" },
    { query: "Miles Davis", type: "urn:entity:artist" },
    { query: "Bob Dylan", type: "urn:entity:artist" },
    { query: "Daft Punk", type: "urn:entity:artist" },
    { query: "Kendrick Lamar", type: "urn:entity:artist" },
    { query: "Pink Floyd", type: "urn:entity:artist" },
    { query: "Nirvana", type: "urn:entity:artist" },
    // International artists
    { query: "BTS", type: "urn:entity:artist" },
    { query: "Bad Bunny", type: "urn:entity:artist" },
    { query: "Rosalía", type: "urn:entity:artist" },
    { query: "Stromae", type: "urn:entity:artist" },
    // Classical
    { query: "Mozart", type: "urn:entity:artist" },
    { query: "Beethoven", type: "urn:entity:artist" },
    // Electronic
    { query: "Aphex Twin", type: "urn:entity:artist" },
    { query: "Boards of Canada", type: "urn:entity:artist" },
    // Jazz
    { query: "John Coltrane", type: "urn:entity:artist" },
    { query: "Nina Simone", type: "urn:entity:artist" }
  ],

  tv_show: [
    // Drama
    { query: "Breaking Bad", type: "urn:entity:tv_show" },
    { query: "The Sopranos", type: "urn:entity:tv_show" },
    { query: "Game of Thrones", type: "urn:entity:tv_show" },
    { query: "The Wire", type: "urn:entity:tv_show" },
    { query: "Mad Men", type: "urn:entity:tv_show" },
    // Comedy
    { query: "The Office US", type: "urn:entity:tv_show" },
    { query: "Friends", type: "urn:entity:tv_show" },
    { query: "Seinfeld", type: "urn:entity:tv_show" },
    { query: "Parks and Recreation", type: "urn:entity:tv_show" },
    { query: "Arrested Development", type: "urn:entity:tv_show" },
    // Sci-fi
    { query: "Stranger Things", type: "urn:entity:tv_show" },
    { query: "Black Mirror", type: "urn:entity:tv_show" },
    { query: "Westworld", type: "urn:entity:tv_show" },
    { query: "The Expanse", type: "urn:entity:tv_show" },
    // International
    { query: "Squid Game", type: "urn:entity:tv_show" },
    { query: "Dark", type: "urn:entity:tv_show" },
    { query: "Money Heist", type: "urn:entity:tv_show" },
    // Recent
    { query: "The Last of Us", type: "urn:entity:tv_show" },
    { query: "Succession", type: "urn:entity:tv_show" },
    { query: "The Bear", type: "urn:entity:tv_show" }
  ],

  book: [
    // Fiction
    { query: "1984 George Orwell", type: "urn:entity:book" },
    { query: "To Kill a Mockingbird", type: "urn:entity:book" },
    { query: "The Great Gatsby", type: "urn:entity:book" },
    { query: "Harry Potter and the Sorcerer's Stone", type: "urn:entity:book" },
    { query: "The Lord of the Rings", type: "urn:entity:book" },
    // Non-fiction
    { query: "Sapiens", type: "urn:entity:book" },
    { query: "Thinking Fast and Slow", type: "urn:entity:book" },
    { query: "The Power of Habit", type: "urn:entity:book" },
    { query: "Educated", type: "urn:entity:book" },
    { query: "Becoming Michelle Obama", type: "urn:entity:book" },
    // Classics
    { query: "Pride and Prejudice", type: "urn:entity:book" },
    { query: "Moby Dick", type: "urn:entity:book" },
    { query: "The Catcher in the Rye", type: "urn:entity:book" },
    // Modern
    { query: "The Hunger Games", type: "urn:entity:book" },
    { query: "Gone Girl", type: "urn:entity:book" },
    { query: "The Girl with the Dragon Tattoo", type: "urn:entity:book" },
    // International
    { query: "One Hundred Years of Solitude", type: "urn:entity:book" },
    { query: "The Alchemist", type: "urn:entity:book" },
    { query: "Norwegian Wood", type: "urn:entity:book" },
    { query: "The Shadow of the Wind", type: "urn:entity:book" }
  ],

  videogame: [
    // AAA titles
    { query: "The Last of Us", type: "urn:entity:videogame" },
    { query: "Red Dead Redemption 2", type: "urn:entity:videogame" },
    { query: "The Witcher 3", type: "urn:entity:videogame" },
    { query: "Grand Theft Auto V", type: "urn:entity:videogame" },
    { query: "The Legend of Zelda Breath of the Wild", type: "urn:entity:videogame" },
    // Indie games
    { query: "Hades", type: "urn:entity:videogame" },
    { query: "Celeste", type: "urn:entity:videogame" },
    { query: "Hollow Knight", type: "urn:entity:videogame" },
    { query: "Stardew Valley", type: "urn:entity:videogame" },
    { query: "Undertale", type: "urn:entity:videogame" },
    // Multiplayer
    { query: "Fortnite", type: "urn:entity:videogame" },
    { query: "League of Legends", type: "urn:entity:videogame" },
    { query: "Counter-Strike", type: "urn:entity:videogame" },
    { query: "Minecraft", type: "urn:entity:videogame" },
    { query: "Among Us", type: "urn:entity:videogame" },
    // Classic
    { query: "Super Mario Bros", type: "urn:entity:videogame" },
    { query: "Tetris", type: "urn:entity:videogame" },
    { query: "Portal", type: "urn:entity:videogame" },
    { query: "Half-Life", type: "urn:entity:videogame" },
    { query: "Doom", type: "urn:entity:videogame" }
  ],

  podcast: [
    // True crime
    { query: "Serial", type: "urn:entity:podcast" },
    { query: "Crime Junkie", type: "urn:entity:podcast" },
    { query: "My Favorite Murder", type: "urn:entity:podcast" },
    { query: "Criminal", type: "urn:entity:podcast" },
    // Interview/Talk
    { query: "The Joe Rogan Experience", type: "urn:entity:podcast" },
    { query: "Fresh Air", type: "urn:entity:podcast" },
    { query: "WTF with Marc Maron", type: "urn:entity:podcast" },
    { query: "Conan O'Brien Needs a Friend", type: "urn:entity:podcast" },
    // Educational
    { query: "Radiolab", type: "urn:entity:podcast" },
    { query: "This American Life", type: "urn:entity:podcast" },
    { query: "Planet Money", type: "urn:entity:podcast" },
    { query: "Stuff You Should Know", type: "urn:entity:podcast" },
    // Tech
    { query: "Reply All", type: "urn:entity:podcast" },
    { query: "The Vergecast", type: "urn:entity:podcast" },
    { query: "Darknet Diaries", type: "urn:entity:podcast" },
    // News
    { query: "The Daily", type: "urn:entity:podcast" },
    { query: "Up First", type: "urn:entity:podcast" },
    // Comedy
    { query: "Comedy Bang Bang", type: "urn:entity:podcast" },
    { query: "How Did This Get Made", type: "urn:entity:podcast" },
    { query: "My Dad Wrote a Porno", type: "urn:entity:podcast" }
  ]
};

// Search variations to test robustness
export const SEARCH_VARIATIONS = [
  // Exact matches
  { query: "The Matrix", shouldFind: true },
  { query: "Matrix", shouldFind: true },
  
  // Case variations
  { query: "the matrix", shouldFind: true },
  { query: "THE MATRIX", shouldFind: true },
  { query: "ThE mAtRiX", shouldFind: true },
  
  // With year
  { query: "The Matrix 1999", shouldFind: true },
  { query: "The Matrix (1999)", shouldFind: true },
  
  // Typos
  { query: "The Matix", shouldFind: true }, // Missing 'r'
  { query: "The Matrics", shouldFind: true }, // Wrong letter
  { query: "Teh Matrix", shouldFind: true }, // Transposed
  
  // Extra words
  { query: "The Matrix movie", shouldFind: true },
  { query: "The Matrix film", shouldFind: true },
  { query: "watch The Matrix", shouldFind: true },
  
  // Special characters
  { query: "Spider-Man", shouldFind: true },
  { query: "Spider Man", shouldFind: true },
  { query: "León: The Professional", shouldFind: true },
  { query: "Leon The Professional", shouldFind: true },
  
  // Ambiguous searches
  { query: "Dune", shouldFind: true }, // Could be book or movie
  { query: "The Office", shouldFind: true }, // US or UK version
  { query: "Sherlock Holmes", shouldFind: true }, // Many versions
  
  // Non-existent
  { query: "Completely Made Up Movie XYZ123", shouldFind: false },
  { query: "asdfghjkl", shouldFind: false }
];

// Entity combinations for cross-type testing
export const ENTITY_COMBINATIONS = [
  // Same type combinations
  { input1: "movie", input2: "movie", output: "movie" },
  { input1: "music", input2: "music", output: "music" },
  { input1: "tv_show", input2: "tv_show", output: "tv_show" },
  { input1: "book", input2: "book", output: "book" },
  { input1: "videogame", input2: "videogame", output: "videogame" },
  { input1: "podcast", input2: "podcast", output: "podcast" },
  
  // Cross-type combinations (all permutations)
  { input1: "movie", input2: "music", output: "tv_show" },
  { input1: "movie", input2: "book", output: "music" },
  { input1: "movie", input2: "tv_show", output: "videogame" },
  { input1: "movie", input2: "videogame", output: "book" },
  { input1: "movie", input2: "podcast", output: "tv_show" },
  
  { input1: "music", input2: "book", output: "movie" },
  { input1: "music", input2: "tv_show", output: "podcast" },
  { input1: "music", input2: "videogame", output: "movie" },
  { input1: "music", input2: "podcast", output: "book" },
  
  { input1: "book", input2: "tv_show", output: "movie" },
  { input1: "book", input2: "videogame", output: "tv_show" },
  { input1: "book", input2: "podcast", output: "music" },
  
  { input1: "tv_show", input2: "videogame", output: "movie" },
  { input1: "tv_show", input2: "podcast", output: "book" },
  
  { input1: "videogame", input2: "podcast", output: "movie" }
];

// Helper to get random entities for testing
export function getRandomEntity(type: keyof typeof TEST_ENTITIES): TestEntity {
  const entities = TEST_ENTITIES[type];
  return entities[Math.floor(Math.random() * entities.length)];
}

// Helper to get a set of entities that avoids cache
export function getUncachedEntitySet(type: keyof typeof TEST_ENTITIES, count: number = 5): TestEntity[] {
  const entities = TEST_ENTITIES[type];
  const timestamp = Date.now();
  
  // Add timestamp to make them unique
  return entities.slice(0, count).map((entity, index) => ({
    ...entity,
    query: `${entity.query} test${timestamp}${index}`
  }));
}

// Edge case entities
export const EDGE_CASE_ENTITIES = [
  // Sequels
  { query: "The Matrix Reloaded", type: "urn:entity:movie" },
  { query: "The Godfather Part II", type: "urn:entity:movie" },
  { query: "Toy Story 2", type: "urn:entity:movie" },
  
  // Remakes
  { query: "Dune 2021", type: "urn:entity:movie" },
  { query: "Dune 1984", type: "urn:entity:movie" },
  { query: "The Office US", type: "urn:entity:tv_show" },
  { query: "The Office UK", type: "urn:entity:tv_show" },
  
  // Very long names
  { query: "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb", type: "urn:entity:movie" },
  { query: "The Lord of the Rings: The Return of the King", type: "urn:entity:movie" },
  
  // Numbers and special characters
  { query: "2001: A Space Odyssey", type: "urn:entity:movie" },
  { query: "12 Years a Slave", type: "urn:entity:movie" },
  { query: "Se7en", type: "urn:entity:movie" },
  { query: "WALL·E", type: "urn:entity:movie" },
  
  // Non-English
  { query: "Amélie", type: "urn:entity:movie" },
  { query: "Crouching Tiger, Hidden Dragon", type: "urn:entity:movie" },
  { query: "La Casa de Papel", type: "urn:entity:tv_show" }
];