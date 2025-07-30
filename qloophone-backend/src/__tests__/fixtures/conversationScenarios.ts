export interface ConversationStep {
  speaker: 'user' | 'assistant';
  text: string;
  expectedFunctions?: Array<{
    name: string;
    args?: any;
  }>;
}

export interface ConversationScenario {
  name: string;
  description: string;
  steps: ConversationStep[];
  expectedOutcome: {
    functionCallCount: number;
    recommendationType?: string;
    shouldSucceed: boolean;
  };
}

export const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    name: 'basic-movie-music-to-tv',
    description: 'User gives movie and music, asks for TV show',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I love The Matrix and Daft Punk. What TV show should I watch?",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'The Matrix' } },
          { name: 'search_entity', args: { query: 'Daft Punk' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:tv_show' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Oh, interesting combo - sci-fi meets electronic music. Based on your love for The Matrix and Daft Punk, you should definitely check out Black Mirror."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      recommendationType: 'urn:entity:tv_show',
      shouldSucceed: true
    }
  },

  {
    name: 'cross-domain-book-game-to-movie',
    description: 'User gives book and game, asks for movie',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I really enjoyed reading 1984 and playing BioShock. Can you recommend a movie?",
        expectedFunctions: [
          { name: 'search_entity', args: { query: '1984' } },
          { name: 'search_entity', args: { query: 'BioShock' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:movie' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Perfect combo of dystopian literature and atmospheric gaming. You'd love Blade Runner 2049 - it has that same dystopian atmosphere and philosophical depth."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      recommendationType: 'urn:entity:movie',
      shouldSucceed: true
    }
  },

  {
    name: 'ambiguous-search-handling',
    description: 'User gives ambiguous entity names',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I like Dune and The Office. What should I read next?",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'Dune' } },
          { name: 'search_entity', args: { query: 'The Office' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:book' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Interesting mix of epic sci-fi and workplace comedy! Based on Dune and The Office, I'd recommend 'The Hitchhiker's Guide to the Galaxy' - it combines epic scope with brilliant humor."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      recommendationType: 'urn:entity:book',
      shouldSucceed: true
    }
  },

  {
    name: 'multiple-recommendations',
    description: 'User asks for alternatives',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I love Inception and classical music like Mozart",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'Inception' } },
          { name: 'search_entity', args: { query: 'Mozart' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:movie' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Oh, complex narratives and classical composition - great taste! You should watch Interstellar. It's got that same Christopher Nolan complexity with an incredible Hans Zimmer score."
      },
      {
        speaker: 'user',
        text: "What else would you recommend?",
        expectedFunctions: [] // Should use existing search results
      },
      {
        speaker: 'assistant',
        text: "Alright, option two: The Prestige. Another mind-bending Nolan film with a haunting classical-influenced score."
      },
      {
        speaker: 'user',
        text: "One more?",
        expectedFunctions: []
      },
      {
        speaker: 'assistant',
        text: "Last one, but it's solid: Arrival. It's got that intellectual complexity you like with a beautiful, minimalist score by Jóhann Jóhannsson."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3, // Only the initial searches and recommendation
      recommendationType: 'urn:entity:movie',
      shouldSucceed: true
    }
  },

  {
    name: 'error-recovery-search-failure',
    description: 'Search fails for obscure entity',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I love XYZ123NonExistent and The Beatles",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'XYZ123NonExistent' } },
          { name: 'search_entity', args: { query: 'The Beatles' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Hmm, I couldn't find the first one. Could you tell me more about what XYZ123NonExistent is, or give me something else you enjoy?"
      },
      {
        speaker: 'user',
        text: "Oh sorry, I meant Stranger Things",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'Stranger Things' } },
          { name: 'get_recommendation' } // Now can proceed with Beatles + Stranger Things
        ]
      },
      {
        speaker: 'assistant',
        text: "Perfect! Based on Stranger Things and The Beatles, you'd love The Umbrella Academy - it's got that supernatural mystery vibe with an incredible classic rock soundtrack."
      }
    ],
    expectedOutcome: {
      functionCallCount: 4,
      shouldSucceed: true
    }
  },

  {
    name: 'location-based-recommendation',
    description: 'User asks for restaurants/venues',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I love sushi and jazz music. Where should I eat in Seattle?",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'sushi' } },
          { name: 'search_entity', args: { query: 'jazz music' } },
          { name: 'get_fan_venues', args: { venue_type: 'restaurant', location: 'Seattle' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Great combo! For sushi lovers who appreciate jazz, I'd recommend Shiro's Sushi in Seattle. It's got that refined, artistic approach to sushi that jazz fans tend to appreciate."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      shouldSucceed: true
    }
  },

  {
    name: 'no-output-type-inference',
    description: 'User doesnt specify what they want',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I like Breaking Bad and The Wire",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'Breaking Bad' } },
          { name: 'search_entity', args: { query: 'The Wire' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:tv_show' } } // Should infer TV show
        ]
      },
      {
        speaker: 'assistant',
        text: "Two of the greatest TV dramas! You'd absolutely love True Detective - especially the first season. It's got that same gritty realism and complex character development."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      recommendationType: 'urn:entity:tv_show',
      shouldSucceed: true
    }
  },

  {
    name: 'special-characters-handling',
    description: 'Entities with special characters',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I enjoyed Amélie and WALL·E. What book should I read?",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'Amélie' } },
          { name: 'search_entity', args: { query: 'WALL·E' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:book' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Such whimsical, heartwarming choices! You'd love 'The Little Prince' - it has that same magical, innocent perspective on life and love."
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      recommendationType: 'urn:entity:book',
      shouldSucceed: true
    }
  },

  {
    name: 'sequel-filtering',
    description: 'Ensure sequels are filtered out',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "I love The Matrix and Star Wars. What movie should I watch?",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'The Matrix' } },
          { name: 'search_entity', args: { query: 'Star Wars' } },
          { name: 'get_recommendation', args: { output_type: 'urn:entity:movie' } }
        ]
      },
      {
        speaker: 'assistant',
        text: "Epic sci-fi classics! You'd love Blade Runner - it's got that perfect mix of philosophical sci-fi and groundbreaking visuals. Not The Matrix Reloaded, because who needs sequels when there are so many great originals!"
      }
    ],
    expectedOutcome: {
      functionCallCount: 3,
      recommendationType: 'urn:entity:movie',
      shouldSucceed: true
    }
  }
];

// Scenarios specifically for testing function availability issues
export const FUNCTION_AVAILABILITY_SCENARIOS: ConversationScenario[] = [
  {
    name: 'immediate-function-call',
    description: 'Test if functions work immediately after greeting',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "The Matrix and jazz",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'The Matrix' } },
          { name: 'search_entity', args: { query: 'jazz' } }
        ]
      }
    ],
    expectedOutcome: {
      functionCallCount: 2,
      shouldSucceed: true
    }
  },

  {
    name: 'explicit-tool-check',
    description: 'User asks about available tools',
    steps: [
      {
        speaker: 'assistant',
        text: "Hey, it's QlooPhone. Can't decide what to do? I got you. Name two things you love - I'll find your perfect match."
      },
      {
        speaker: 'user',
        text: "What tools do you have available?"
      },
      {
        speaker: 'assistant',
        text: "I have access to search for any cultural item, get personalized recommendations, search for locations, and find venues where fans hang out. Just tell me two things you love!"
      },
      {
        speaker: 'user',
        text: "Great! I love Inception and Radiohead",
        expectedFunctions: [
          { name: 'search_entity', args: { query: 'Inception' } },
          { name: 'search_entity', args: { query: 'Radiohead' } }
        ]
      }
    ],
    expectedOutcome: {
      functionCallCount: 2,
      shouldSucceed: true
    }
  }
];