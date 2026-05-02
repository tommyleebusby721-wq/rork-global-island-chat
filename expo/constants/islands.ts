export interface Island {
  id: string;
  name: string;
  subtitle?: string;
  flag: string;
  flagCode: string;
  region: string;
  bio: string;
}

export const ISLANDS: Island[] = [
  { id: 'sint-maarten-dutch', name: 'Sint Maarten', subtitle: 'Dutch Side', flag: '🇸🇽', flagCode: 'sx', region: 'Leeward Islands', bio: 'The Dutch side of the Friendly Island. Casinos, Maho Beach, Philipsburg boardwalk and late-night Simpson Bay vibes.' },
  { id: 'saint-martin-french', name: 'Saint Martin', subtitle: 'French Side', flag: '🇫🇷', flagCode: 'mf', region: 'Leeward Islands', bio: 'The French side. Grand Case gastronomy, Orient Bay sunrises and laid-back Caribbean-Euro charm.' },
  { id: 'anguilla', name: 'Anguilla', flag: '🇦🇮', flagCode: 'ai', region: 'Leeward Islands', bio: 'Powder-soft beaches, turquoise water and world-class beach bars. Small island, big soul.' },
  { id: 'antigua-barbuda', name: 'Antigua & Barbuda', flag: '🇦🇬', flagCode: 'ag', region: 'Leeward Islands', bio: '365 beaches — one for every day of the year. Sailing capital of the Caribbean.' },
  { id: 'saint-kitts-nevis', name: 'Saint Kitts & Nevis', flag: '🇰🇳', flagCode: 'kn', region: 'Leeward Islands', bio: 'Twin-island federation. Volcanic peaks, rainforest hikes and deep colonial history.' },
  { id: 'montserrat', name: 'Montserrat', flag: '🇲🇸', flagCode: 'ms', region: 'Leeward Islands', bio: 'The Emerald Isle of the Caribbean — volcano views, lush hills and tight-knit community.' },
  { id: 'guadeloupe', name: 'Guadeloupe', flag: '🇬🇵', flagCode: 'gp', region: 'Leeward Islands', bio: 'Butterfly-shaped French archipelago. Waterfalls, Creole food and sound-system culture.' },
  { id: 'saint-barthelemy', name: 'Saint Barthélemy', flag: '🇧🇱', flagCode: 'bl', region: 'Leeward Islands', bio: 'St Barts — chic French outpost. Gustavia yachts, St Jean beach and dreamy sunsets.' },

  { id: 'dominica', name: 'Dominica', flag: '🇩🇲', flagCode: 'dm', region: 'Windward Islands', bio: 'Nature Isle of the Caribbean. Boiling Lake, hot springs and untouched rainforest.' },
  { id: 'martinique', name: 'Martinique', flag: '🇲🇶', flagCode: 'mq', region: 'Windward Islands', bio: 'Flower of the Caribbean. French flair, rum distilleries and Mount Pelée.' },
  { id: 'saint-lucia', name: 'Saint Lucia', flag: '🇱🇨', flagCode: 'lc', region: 'Windward Islands', bio: 'The Pitons, Sulphur Springs and honeymoon-level sunsets over Soufrière.' },
  { id: 'saint-vincent', name: 'Saint Vincent & the Grenadines', flag: '🇻🇨', flagCode: 'vc', region: 'Windward Islands', bio: 'Home of Bequia and the Tobago Cays. Sailing paradise and soca energy.' },
  { id: 'grenada', name: 'Grenada', flag: '🇬🇩', flagCode: 'gd', region: 'Windward Islands', bio: 'The Spice Isle. Grand Anse beach, underwater sculpture park and nutmeg everything.' },
  { id: 'barbados', name: 'Barbados', flag: '🇧🇧', flagCode: 'bb', region: 'Windward Islands', bio: 'Home of Rihanna, flying fish and Oistins fish fry. Bajan pride runs deep.' },

  { id: 'trinidad', name: 'Trinidad', flag: '🇹🇹', flagCode: 'tt', region: 'Southern Caribbean', bio: 'Carnival capital of the Caribbean. Soca, steelpan, doubles and Port of Spain energy.' },
  { id: 'tobago', name: 'Tobago', flag: '🇹🇹', flagCode: 'tt', region: 'Southern Caribbean', bio: 'Laid-back sister isle. Pigeon Point, Nylon Pool and Sunday School in Buccoo.' },
  { id: 'aruba', name: 'Aruba', flag: '🇦🇼', flagCode: 'aw', region: 'Southern Caribbean', bio: 'One happy island. Eagle Beach, divi trees and constant trade-wind breeze.' },
  { id: 'curacao', name: 'Curaçao', flag: '🇨🇼', flagCode: 'cw', region: 'Southern Caribbean', bio: 'Colorful Willemstad, floating bridge and hidden coves. Dushi island life.' },
  { id: 'bonaire', name: 'Bonaire', flag: '🇧🇶', flagCode: 'bq', region: 'Southern Caribbean', bio: 'Diver\'s paradise. Flamingos, salt flats and the quietest of the ABCs.' },

  { id: 'jamaica', name: 'Jamaica', flag: '🇯🇲', flagCode: 'jm', region: 'Greater Antilles', bio: 'One love. Reggae, dancehall, jerk, Negril sunsets and Blue Mountain coffee.' },
  { id: 'dominican-republic', name: 'Dominican Republic', flag: '🇩🇴', flagCode: 'do', region: 'Greater Antilles', bio: 'Bachata, merengue, Punta Cana beaches and Santo Domingo history.' },
  { id: 'haiti', name: 'Haiti', flag: '🇭🇹', flagCode: 'ht', region: 'Greater Antilles', bio: 'First Black republic. Rich art, kompa music and resilient spirit.' },
  { id: 'cuba', name: 'Cuba', flag: '🇨🇺', flagCode: 'cu', region: 'Greater Antilles', bio: 'Havana classics, salsa rhythms, cigars and living history.' },
  { id: 'puerto-rico', name: 'Puerto Rico', flag: '🇵🇷', flagCode: 'pr', region: 'Greater Antilles', bio: 'Isla del Encanto. Old San Juan, El Yunque and reggaetón worldwide.' },
  { id: 'cayman-islands', name: 'Cayman Islands', flag: '🇰🇾', flagCode: 'ky', region: 'Greater Antilles', bio: 'Seven Mile Beach, Stingray City and calm turquoise waters.' },

  { id: 'bahamas', name: 'Bahamas', flag: '🇧🇸', flagCode: 'bs', region: 'Lucayan Archipelago', bio: '700 islands of pink sand, Junkanoo and impossibly clear water.' },
  { id: 'turks-caicos', name: 'Turks & Caicos', flag: '🇹🇨', flagCode: 'tc', region: 'Lucayan Archipelago', bio: 'Grace Bay perfection. Beautiful by nature, conch by tradition.' },

  { id: 'us-virgin-islands', name: 'US Virgin Islands', flag: '🇻🇮', flagCode: 'vi', region: 'Virgin Islands', bio: 'St Thomas, St John and St Croix — America\'s Caribbean.' },
  { id: 'british-virgin-islands', name: 'British Virgin Islands', flag: '🇻🇬', flagCode: 'vg', region: 'Virgin Islands', bio: 'Sailing mecca. Tortola, Virgin Gorda and the Baths.' },

  { id: 'guyana', name: 'Guyana', flag: '🇬🇾', flagCode: 'gy', region: 'Mainland Caribbean', bio: 'Land of many waters. Kaieteur Falls, rainforest and Caribbean-South American fusion.' },
  { id: 'belize', name: 'Belize', flag: '🇧🇿', flagCode: 'bz', region: 'Mainland Caribbean', bio: 'Barrier reef, Mayan ruins and island-time Caye Caulker vibes.' },
];

export function getIsland(id: string): Island | undefined {
  return ISLANDS.find(i => i.id === id);
}
