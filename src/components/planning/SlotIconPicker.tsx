import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'

export type SlotEmoji = {
  emoji: string
  label: string
  /** Extra search terms — the label alone often isn't what people type. */
  keywords?: string[]
}

export type SlotEmojiGroup = {
  name: string
  emojis: SlotEmoji[]
}

// Curated travel emoji set, grouped. `keywords` widen search beyond the label.
export const SLOT_EMOJI_GROUPS: SlotEmojiGroup[] = [
  {
    name: 'Food',
    emojis: [
      { emoji: '🍽', label: 'Dining', keywords: ['food', 'restaurant', 'dinner', 'lunch', 'meal', 'eat'] },
      { emoji: '🍳', label: 'Breakfast', keywords: ['eggs', 'brunch', 'morning'] },
      { emoji: '🥐', label: 'Croissant', keywords: ['bakery', 'pastry', 'french', 'breakfast'] },
      { emoji: '🥞', label: 'Pancakes', keywords: ['brunch', 'breakfast'] },
      { emoji: '🧇', label: 'Waffles', keywords: ['brunch', 'breakfast'] },
      { emoji: '🥯', label: 'Bagel', keywords: ['breakfast', 'deli'] },
      { emoji: '🥖', label: 'Baguette', keywords: ['bread', 'bakery', 'french'] },
      { emoji: '🧀', label: 'Cheese', keywords: ['fromage', 'tasting'] },
      { emoji: '🍕', label: 'Pizza', keywords: ['italian', 'slice'] },
      { emoji: '🍔', label: 'Burger', keywords: ['american', 'fast food'] },
      { emoji: '🌭', label: 'Hot dog', keywords: ['street food'] },
      { emoji: '🥪', label: 'Sandwich', keywords: ['deli', 'lunch'] },
      { emoji: '🌮', label: 'Tacos', keywords: ['mexican', 'street food'] },
      { emoji: '🌯', label: 'Burrito', keywords: ['mexican', 'wrap'] },
      { emoji: '🫔', label: 'Tamale', keywords: ['mexican'] },
      { emoji: '🥙', label: 'Kebab', keywords: ['gyro', 'pita', 'wrap'] },
      { emoji: '🧆', label: 'Falafel', keywords: ['middle eastern', 'vegetarian'] },
      { emoji: '🥘', label: 'Paella', keywords: ['spanish', 'stew'] },
      { emoji: '🫕', label: 'Fondue', keywords: ['stew', 'swiss', 'cheese'] },
      { emoji: '🍲', label: 'Hot pot', keywords: ['soup', 'stew'] },
      { emoji: '🍜', label: 'Noodles', keywords: ['ramen', 'pho', 'asian', 'soup'] },
      { emoji: '🍝', label: 'Pasta', keywords: ['italian', 'spaghetti'] },
      { emoji: '🍛', label: 'Curry', keywords: ['indian', 'thai', 'rice'] },
      { emoji: '🍚', label: 'Rice', keywords: ['asian'] },
      { emoji: '🍣', label: 'Sushi', keywords: ['japanese', 'sashimi', 'fish'] },
      { emoji: '🍱', label: 'Bento', keywords: ['japanese', 'lunch box'] },
      { emoji: '🥟', label: 'Dumplings', keywords: ['dim sum', 'chinese', 'gyoza'] },
      { emoji: '🦐', label: 'Shrimp', keywords: ['seafood', 'prawn'] },
      { emoji: '🦞', label: 'Lobster', keywords: ['seafood'] },
      { emoji: '🦀', label: 'Crab', keywords: ['seafood'] },
      { emoji: '🦪', label: 'Oysters', keywords: ['seafood', 'raw bar'] },
      { emoji: '🐟', label: 'Fish', keywords: ['seafood'] },
      { emoji: '🥩', label: 'Steak', keywords: ['meat', 'grill', 'steakhouse'] },
      { emoji: '🍗', label: 'Chicken', keywords: ['poultry', 'meat'] },
      { emoji: '🥓', label: 'Bacon', keywords: ['breakfast', 'meat'] },
      { emoji: '🥗', label: 'Salad', keywords: ['healthy', 'vegetarian', 'greens'] },
      { emoji: '🥑', label: 'Avocado', keywords: ['healthy', 'brunch'] },
      { emoji: '🍉', label: 'Fruit', keywords: ['watermelon', 'fresh', 'healthy'] },
      { emoji: '🍓', label: 'Berries', keywords: ['strawberry', 'fruit'] },
      { emoji: '🥥', label: 'Coconut', keywords: ['tropical', 'beach'] },
      { emoji: '🌶', label: 'Spicy', keywords: ['chili', 'hot', 'pepper'] },
      { emoji: '🍰', label: 'Cake', keywords: ['dessert', 'sweet', 'birthday'] },
      { emoji: '🧁', label: 'Cupcake', keywords: ['dessert', 'bakery', 'sweet'] },
      { emoji: '🥧', label: 'Pie', keywords: ['dessert', 'sweet'] },
      { emoji: '🍩', label: 'Donut', keywords: ['dessert', 'sweet', 'bakery'] },
      { emoji: '🍪', label: 'Cookie', keywords: ['dessert', 'sweet'] },
      { emoji: '🍫', label: 'Chocolate', keywords: ['dessert', 'sweet'] },
      { emoji: '🍦', label: 'Ice cream', keywords: ['gelato', 'dessert', 'sweet'] },
      { emoji: '🍧', label: 'Shaved ice', keywords: ['dessert', 'sweet'] },
      { emoji: '🍯', label: 'Honey', keywords: ['sweet', 'market'] },
      { emoji: '🥡', label: 'Takeout', keywords: ['to go', 'delivery'] },
      { emoji: '🧺', label: 'Picnic', keywords: ['basket', 'outdoor', 'park'] },
    ],
  },
  {
    name: 'Drink',
    emojis: [
      { emoji: '☕', label: 'Coffee', keywords: ['cafe', 'espresso', 'latte', 'morning'] },
      { emoji: '🍵', label: 'Tea', keywords: ['matcha', 'teahouse'] },
      { emoji: '🧋', label: 'Boba', keywords: ['bubble tea', 'milk tea'] },
      { emoji: '🥤', label: 'Soft drink', keywords: ['soda', 'juice', 'smoothie'] },
      { emoji: '🧃', label: 'Juice', keywords: ['drink', 'fresh'] },
      { emoji: '🍷', label: 'Wine', keywords: ['vineyard', 'winery', 'tasting', 'bar'] },
      { emoji: '🥂', label: 'Champagne', keywords: ['toast', 'celebrate', 'prosecco', 'bubbly'] },
      { emoji: '🍸', label: 'Cocktails', keywords: ['martini', 'bar', 'drinks', 'happy hour'] },
      { emoji: '🍹', label: 'Tropical drink', keywords: ['cocktail', 'beach', 'tiki'] },
      { emoji: '🍺', label: 'Beer', keywords: ['pub', 'brewery', 'bar', 'pint'] },
      { emoji: '🍻', label: 'Cheers', keywords: ['beers', 'pub', 'group', 'toast'] },
      { emoji: '🥃', label: 'Whiskey', keywords: ['bourbon', 'scotch', 'nightcap', 'bar'] },
      { emoji: '🍶', label: 'Sake', keywords: ['japanese', 'drink'] },
      { emoji: '🧉', label: 'Maté', keywords: ['drink', 'south america'] },
      { emoji: '🫗', label: 'Pour', keywords: ['drink', 'tasting'] },
    ],
  },
  {
    name: 'Nightlife',
    emojis: [
      { emoji: '🎉', label: 'Party', keywords: ['celebrate', 'night out'] },
      { emoji: '🪩', label: 'Club', keywords: ['disco', 'dance', 'nightclub'] },
      { emoji: '💃', label: 'Dancing', keywords: ['salsa', 'club', 'night'] },
      { emoji: '🕺', label: 'Dance floor', keywords: ['club', 'night'] },
      { emoji: '🎤', label: 'Karaoke', keywords: ['singing', 'live music', 'concert'] },
      { emoji: '🎧', label: 'DJ set', keywords: ['music', 'club', 'headphones'] },
      { emoji: '🎰', label: 'Casino', keywords: ['gambling', 'slots', 'vegas'] },
      { emoji: '🃏', label: 'Cards', keywords: ['poker', 'casino', 'games'] },
      { emoji: '🎆', label: 'Fireworks', keywords: ['celebration', 'night', 'festival'] },
      { emoji: '🌃', label: 'City night', keywords: ['skyline', 'evening', 'nightlife'] },
    ],
  },
  {
    name: 'Culture',
    emojis: [
      { emoji: '🎭', label: 'Theatre', keywords: ['play', 'show', 'drama', 'broadway'] },
      { emoji: '🎨', label: 'Art', keywords: ['gallery', 'museum', 'painting', 'exhibit'] },
      { emoji: '🖼', label: 'Gallery', keywords: ['art', 'museum', 'exhibit', 'painting'] },
      { emoji: '🏛', label: 'Museum', keywords: ['ruins', 'history', 'gallery', 'classical'] },
      { emoji: '🎬', label: 'Cinema', keywords: ['movie', 'film', 'theater'] },
      { emoji: '🎵', label: 'Music', keywords: ['concert', 'gig', 'song'] },
      { emoji: '🎼', label: 'Classical', keywords: ['orchestra', 'symphony', 'opera'] },
      { emoji: '🎻', label: 'Orchestra', keywords: ['violin', 'classical', 'symphony'] },
      { emoji: '🎸', label: 'Live music', keywords: ['guitar', 'band', 'rock', 'gig'] },
      { emoji: '🎷', label: 'Jazz', keywords: ['saxophone', 'live music', 'blues'] },
      { emoji: '🥁', label: 'Drums', keywords: ['music', 'percussion', 'band'] },
      { emoji: '📚', label: 'Bookshop', keywords: ['library', 'books', 'reading'] },
      { emoji: '📖', label: 'Reading', keywords: ['book', 'quiet', 'downtime'] },
      { emoji: '🎪', label: 'Circus', keywords: ['show', 'festival', 'tent'] },
      { emoji: '🎡', label: 'Fairground', keywords: ['ferris wheel', 'carnival', 'amusement'] },
      { emoji: '🎢', label: 'Rollercoaster', keywords: ['theme park', 'amusement', 'rides'] },
      { emoji: '🎠', label: 'Carousel', keywords: ['fair', 'amusement', 'kids'] },
      { emoji: '🖌', label: 'Workshop', keywords: ['class', 'craft', 'paint', 'lesson'] },
      { emoji: '📸', label: 'Photography', keywords: ['photos', 'camera', 'shoot'] },
      { emoji: '🗞', label: 'Local news', keywords: ['newspaper', 'reading'] },
    ],
  },
  {
    name: 'Shopping',
    emojis: [
      { emoji: '🛍', label: 'Shopping', keywords: ['shops', 'retail', 'boutique', 'mall'] },
      { emoji: '🛒', label: 'Market', keywords: ['groceries', 'supermarket', 'shopping'] },
      { emoji: '🧺', label: 'Farmers market', keywords: ['market', 'produce', 'local'] },
      { emoji: '💐', label: 'Flower market', keywords: ['flowers', 'bouquet', 'market'] },
      { emoji: '🕯', label: 'Home goods', keywords: ['candle', 'shop', 'decor'] },
      { emoji: '💎', label: 'Jewellery', keywords: ['jewelry', 'shopping', 'luxury'] },
      { emoji: '👗', label: 'Boutique', keywords: ['clothes', 'fashion', 'shopping'] },
      { emoji: '👟', label: 'Sneakers', keywords: ['shoes', 'shopping'] },
      { emoji: '🧳', label: 'Souvenirs', keywords: ['gifts', 'luggage', 'shopping'] },
      { emoji: '🎁', label: 'Gifts', keywords: ['present', 'souvenir', 'shopping'] },
      { emoji: '📿', label: 'Antiques', keywords: ['vintage', 'market', 'flea'] },
    ],
  },
  {
    name: 'Outdoors',
    emojis: [
      { emoji: '🏖', label: 'Beach', keywords: ['sea', 'sand', 'coast', 'swim'] },
      { emoji: '🏝', label: 'Island', keywords: ['tropical', 'beach', 'getaway'] },
      { emoji: '🏔', label: 'Mountain', keywords: ['alps', 'peak', 'summit'] },
      { emoji: '⛰', label: 'Hills', keywords: ['mountain', 'viewpoint', 'trek'] },
      { emoji: '🥾', label: 'Hiking', keywords: ['trek', 'trail', 'walk', 'boots'] },
      { emoji: '🧗', label: 'Climbing', keywords: ['bouldering', 'rock', 'via ferrata'] },
      { emoji: '🚴', label: 'Cycling', keywords: ['bike', 'ride', 'tour'] },
      { emoji: '🏊', label: 'Swimming', keywords: ['pool', 'swim', 'sea'] },
      { emoji: '🏄', label: 'Surfing', keywords: ['waves', 'surf', 'beach'] },
      { emoji: '🤿', label: 'Diving', keywords: ['snorkel', 'scuba', 'reef'] },
      { emoji: '🛶', label: 'Canoe', keywords: ['kayak', 'paddle', 'river'] },
      { emoji: '🚣', label: 'Kayak', keywords: ['rowing', 'paddle', 'boat'] },
      { emoji: '⛵', label: 'Sailing', keywords: ['boat', 'yacht', 'cruise'] },
      { emoji: '🎣', label: 'Fishing', keywords: ['angling', 'lake', 'boat'] },
      { emoji: '⛷', label: 'Skiing', keywords: ['snow', 'slopes', 'alpine', 'winter'] },
      { emoji: '🏂', label: 'Snowboarding', keywords: ['snow', 'slopes', 'winter'] },
      { emoji: '🛷', label: 'Sledding', keywords: ['snow', 'winter', 'toboggan'] },
      { emoji: '⛸', label: 'Ice skating', keywords: ['rink', 'winter'] },
      { emoji: '🏇', label: 'Horse riding', keywords: ['equestrian', 'ranch', 'trail'] },
      { emoji: '🎿', label: 'Ski gear', keywords: ['snow', 'winter', 'rental'] },
      { emoji: '🪂', label: 'Paragliding', keywords: ['skydive', 'flying', 'adventure'] },
      { emoji: '🎈', label: 'Hot air balloon', keywords: ['balloon', 'ride', 'sunrise'] },
      { emoji: '⛺', label: 'Camping', keywords: ['tent', 'outdoors', 'campsite'] },
      { emoji: '🔥', label: 'Campfire', keywords: ['bonfire', 'fire', 'evening'] },
      { emoji: '🧭', label: 'Exploring', keywords: ['compass', 'wander', 'adventure'] },
      { emoji: '🗺', label: 'Tour', keywords: ['map', 'guide', 'sightseeing', 'walking tour'] },
    ],
  },
  {
    name: 'Sport',
    emojis: [
      { emoji: '⚽', label: 'Football', keywords: ['soccer', 'match', 'game', 'stadium'] },
      { emoji: '🏀', label: 'Basketball', keywords: ['game', 'nba', 'match'] },
      { emoji: '🏈', label: 'American football', keywords: ['nfl', 'game'] },
      { emoji: '⚾', label: 'Baseball', keywords: ['game', 'mlb', 'ballpark'] },
      { emoji: '🎾', label: 'Tennis', keywords: ['match', 'court'] },
      { emoji: '🏉', label: 'Rugby', keywords: ['match', 'game'] },
      { emoji: '🏐', label: 'Volleyball', keywords: ['beach', 'game'] },
      { emoji: '🏸', label: 'Badminton', keywords: ['game', 'racket'] },
      { emoji: '🏓', label: 'Table tennis', keywords: ['ping pong', 'game'] },
      { emoji: '⛳', label: 'Golf', keywords: ['course', 'tee', 'round'] },
      { emoji: '🎳', label: 'Bowling', keywords: ['game', 'alley'] },
      { emoji: '🎯', label: 'Darts', keywords: ['pub', 'game'] },
      { emoji: '🎱', label: 'Pool', keywords: ['billiards', 'snooker', 'bar', 'game'] },
      { emoji: '🎮', label: 'Arcade', keywords: ['games', 'video games'] },
      { emoji: '🎲', label: 'Board games', keywords: ['dice', 'games', 'night in'] },
      { emoji: '🥊', label: 'Boxing', keywords: ['fight', 'gym', 'match'] },
      { emoji: '🧘', label: 'Yoga', keywords: ['meditation', 'wellness', 'pilates', 'stretch'] },
      { emoji: '🏋', label: 'Gym', keywords: ['workout', 'fitness', 'weights'] },
      { emoji: '🏃', label: 'Running', keywords: ['jog', 'run', 'marathon'] },
      { emoji: '🚶', label: 'Walk', keywords: ['stroll', 'wander', 'walking'] },
      { emoji: '🏟', label: 'Stadium', keywords: ['arena', 'match', 'game', 'concert'] },
    ],
  },
  {
    name: 'Wellness',
    emojis: [
      { emoji: '💆', label: 'Massage', keywords: ['spa', 'treatment', 'relax'] },
      { emoji: '💅', label: 'Salon', keywords: ['nails', 'beauty', 'pamper'] },
      { emoji: '💇', label: 'Haircut', keywords: ['barber', 'salon'] },
      { emoji: '🧖', label: 'Sauna', keywords: ['spa', 'steam', 'hammam', 'onsen'] },
      { emoji: '♨️', label: 'Hot spring', keywords: ['onsen', 'thermal', 'baths', 'spa'] },
      { emoji: '🛁', label: 'Baths', keywords: ['spa', 'soak', 'thermal'] },
      { emoji: '🕉', label: 'Meditation', keywords: ['mindfulness', 'retreat', 'quiet'] },
      { emoji: '😴', label: 'Rest', keywords: ['nap', 'sleep', 'downtime', 'lie in'] },
    ],
  },
  {
    name: 'Landmarks',
    emojis: [
      { emoji: '🗼', label: 'Tower', keywords: ['landmark', 'eiffel', 'viewpoint'] },
      { emoji: '🗽', label: 'Statue', keywords: ['landmark', 'monument', 'liberty'] },
      { emoji: '🗿', label: 'Monument', keywords: ['landmark', 'statue', 'ruins'] },
      { emoji: '🏰', label: 'Castle', keywords: ['palace', 'fortress', 'chateau'] },
      { emoji: '🏯', label: 'Japanese castle', keywords: ['castle', 'japan', 'landmark'] },
      { emoji: '⛩', label: 'Shrine', keywords: ['torii', 'temple', 'japan'] },
      { emoji: '🛕', label: 'Temple', keywords: ['hindu', 'shrine', 'religious'] },
      { emoji: '🕌', label: 'Mosque', keywords: ['religious', 'islamic'] },
      { emoji: '⛪', label: 'Church', keywords: ['cathedral', 'chapel', 'religious', 'basilica'] },
      { emoji: '🕍', label: 'Synagogue', keywords: ['religious', 'temple'] },
      { emoji: '🌉', label: 'Bridge', keywords: ['landmark', 'crossing', 'viewpoint'] },
      { emoji: '🗾', label: 'Region', keywords: ['map', 'area', 'country'] },
      { emoji: '🏗', label: 'Architecture', keywords: ['building', 'construction', 'modern'] },
      { emoji: '🏙', label: 'Skyline', keywords: ['city', 'downtown', 'viewpoint'] },
      { emoji: '🌆', label: 'Cityscape', keywords: ['city', 'dusk', 'skyline'] },
      { emoji: '⛲', label: 'Fountain', keywords: ['square', 'plaza', 'landmark'] },
      { emoji: '🎇', label: 'Light show', keywords: ['sparkler', 'evening', 'display'] },
    ],
  },
  {
    name: 'Nature',
    emojis: [
      { emoji: '🌅', label: 'Sunrise', keywords: ['dawn', 'early', 'morning'] },
      { emoji: '🌄', label: 'Sunset', keywords: ['dusk', 'golden hour', 'evening'] },
      { emoji: '🌇', label: 'Golden hour', keywords: ['sunset', 'dusk', 'evening'] },
      { emoji: '🌊', label: 'Ocean', keywords: ['sea', 'waves', 'coast'] },
      { emoji: '🏞', label: 'National park', keywords: ['park', 'nature', 'landscape', 'valley'] },
      { emoji: '🌲', label: 'Forest', keywords: ['woods', 'trees', 'trail'] },
      { emoji: '🌴', label: 'Palm trees', keywords: ['tropical', 'beach', 'resort'] },
      { emoji: '🌵', label: 'Desert', keywords: ['cactus', 'dunes', 'arid'] },
      { emoji: '🏜', label: 'Dunes', keywords: ['desert', 'sand'] },
      { emoji: '🌋', label: 'Volcano', keywords: ['crater', 'lava', 'hike'] },
      { emoji: '🏕', label: 'Wilderness', keywords: ['camp', 'outdoors', 'nature'] },
      { emoji: '🌿', label: 'Nature', keywords: ['green', 'plants', 'garden'] },
      { emoji: '🍃', label: 'Gardens', keywords: ['leaves', 'park', 'botanical'] },
      { emoji: '🌸', label: 'Blossom', keywords: ['cherry', 'sakura', 'spring', 'flowers'] },
      { emoji: '🌺', label: 'Tropical flower', keywords: ['hibiscus', 'flowers', 'lei'] },
      { emoji: '🌻', label: 'Sunflowers', keywords: ['fields', 'flowers', 'summer'] },
      { emoji: '🍁', label: 'Autumn', keywords: ['fall', 'leaves', 'foliage'] },
      { emoji: '❄️', label: 'Snow', keywords: ['winter', 'cold', 'ice'] },
      { emoji: '🌙', label: 'Night', keywords: ['evening', 'moon', 'late'] },
      { emoji: '⭐', label: 'Stargazing', keywords: ['star', 'night', 'astronomy'] },
      { emoji: '🌌', label: 'Milky way', keywords: ['stars', 'night sky', 'astronomy'] },
      { emoji: '🌈', label: 'Rainbow', keywords: ['weather', 'colourful'] },
      { emoji: '🐋', label: 'Whale watching', keywords: ['whale', 'boat', 'wildlife'] },
      { emoji: '🐬', label: 'Dolphins', keywords: ['wildlife', 'boat', 'sea'] },
      { emoji: '🐢', label: 'Turtles', keywords: ['wildlife', 'snorkel', 'reef'] },
      { emoji: '🦁', label: 'Safari', keywords: ['wildlife', 'zoo', 'game drive', 'lion'] },
      { emoji: '🐘', label: 'Elephants', keywords: ['safari', 'wildlife', 'sanctuary'] },
      { emoji: '🐧', label: 'Penguins', keywords: ['wildlife', 'zoo', 'aquarium'] },
      { emoji: '🐠', label: 'Aquarium', keywords: ['fish', 'reef', 'snorkel'] },
      { emoji: '🦜', label: 'Birdwatching', keywords: ['birds', 'wildlife', 'parrot'] },
      { emoji: '🐕', label: 'Dog friendly', keywords: ['pet', 'dog', 'walk'] },
    ],
  },
  {
    name: 'Travel',
    emojis: [
      { emoji: '✈️', label: 'Flight', keywords: ['plane', 'airport', 'fly', 'departure'] },
      { emoji: '🛫', label: 'Departure', keywords: ['takeoff', 'flight', 'airport'] },
      { emoji: '🛬', label: 'Arrival', keywords: ['landing', 'flight', 'airport'] },
      { emoji: '🛂', label: 'Passport control', keywords: ['immigration', 'customs', 'border'] },
      { emoji: '🧳', label: 'Luggage', keywords: ['bags', 'checkin', 'pack'] },
      { emoji: '🚂', label: 'Train', keywords: ['rail', 'station', 'metro'] },
      { emoji: '🚄', label: 'High-speed rail', keywords: ['train', 'bullet', 'shinkansen'] },
      { emoji: '🚇', label: 'Metro', keywords: ['subway', 'underground', 'tube'] },
      { emoji: '🚊', label: 'Tram', keywords: ['streetcar', 'light rail'] },
      { emoji: '🚌', label: 'Bus', keywords: ['coach', 'shuttle'] },
      { emoji: '🚗', label: 'Drive', keywords: ['car', 'road trip', 'rental'] },
      { emoji: '🚕', label: 'Taxi', keywords: ['cab', 'uber', 'ride'] },
      { emoji: '🛺', label: 'Tuk-tuk', keywords: ['rickshaw', 'ride'] },
      { emoji: '🏍', label: 'Motorbike', keywords: ['motorcycle', 'ride'] },
      { emoji: '🛵', label: 'Scooter', keywords: ['moped', 'vespa', 'ride'] },
      { emoji: '🚲', label: 'Bike', keywords: ['bicycle', 'cycle', 'rental'] },
      { emoji: '⛴', label: 'Ferry', keywords: ['boat', 'crossing', 'port'] },
      { emoji: '🛳', label: 'Cruise', keywords: ['ship', 'boat', 'liner'] },
      { emoji: '🚁', label: 'Helicopter', keywords: ['scenic flight', 'transfer'] },
      { emoji: '🚡', label: 'Cable car', keywords: ['gondola', 'funicular', 'lift'] },
      { emoji: '🚠', label: 'Funicular', keywords: ['cable car', 'mountain', 'lift'] },
      { emoji: '🅿️', label: 'Parking', keywords: ['car park', 'garage'] },
      { emoji: '⛽', label: 'Fuel stop', keywords: ['gas', 'petrol', 'road trip'] },
    ],
  },
  {
    name: 'Stays',
    emojis: [
      { emoji: '🏨', label: 'Hotel', keywords: ['stay', 'accommodation', 'checkin'] },
      { emoji: '🏩', label: 'Resort', keywords: ['hotel', 'stay', 'spa'] },
      { emoji: '🏠', label: 'Rental', keywords: ['airbnb', 'house', 'apartment', 'stay'] },
      { emoji: '🏡', label: 'Cottage', keywords: ['cabin', 'countryside', 'stay'] },
      { emoji: '🛖', label: 'Cabin', keywords: ['hut', 'lodge', 'stay'] },
      { emoji: '🏘', label: 'Neighbourhood', keywords: ['area', 'district', 'houses'] },
      { emoji: '🛏', label: 'Check in', keywords: ['bed', 'hotel', 'room', 'stay'] },
      { emoji: '🔑', label: 'Key pickup', keywords: ['checkin', 'keys', 'access'] },
      { emoji: '🧹', label: 'Check out', keywords: ['leave', 'clean', 'hotel'] },
    ],
  },
  {
    name: 'Practical',
    emojis: [
      { emoji: '🎟', label: 'Tickets', keywords: ['booking', 'entry', 'admission', 'reservation'] },
      { emoji: '🎫', label: 'Booking', keywords: ['ticket', 'reservation', 'entry'] },
      { emoji: '📅', label: 'Scheduled', keywords: ['calendar', 'date', 'booking'] },
      { emoji: '⏰', label: 'Early start', keywords: ['alarm', 'wake up', 'time'] },
      { emoji: '⌛', label: 'Free time', keywords: ['gap', 'flexible', 'downtime'] },
      { emoji: '💰', label: 'Budget', keywords: ['money', 'cost', 'cash'] },
      { emoji: '💳', label: 'Payment', keywords: ['card', 'pay', 'money'] },
      { emoji: '🏧', label: 'Cash', keywords: ['atm', 'money', 'withdraw'] },
      { emoji: '📱', label: 'SIM / data', keywords: ['phone', 'esim', 'wifi'] },
      { emoji: '🔌', label: 'Adapter', keywords: ['charger', 'plug', 'power'] },
      { emoji: '💊', label: 'Pharmacy', keywords: ['medicine', 'chemist', 'health'] },
      { emoji: '🏥', label: 'Medical', keywords: ['hospital', 'doctor', 'clinic'] },
      { emoji: '🧴', label: 'Sunscreen', keywords: ['toiletries', 'pharmacy', 'beach'] },
      { emoji: '☔', label: 'Rain plan', keywords: ['umbrella', 'weather', 'backup'] },
      { emoji: '📍', label: 'Meeting point', keywords: ['pin', 'location', 'meet', 'where'] },
      { emoji: '📌', label: 'Placeholder', keywords: ['pin', 'todo', 'tbd', 'note'] },
      { emoji: '❓', label: 'To decide', keywords: ['tbd', 'unsure', 'question', 'maybe'] },
      { emoji: '✅', label: 'Confirmed', keywords: ['booked', 'done', 'locked'] },
      { emoji: '⚠️', label: 'Heads up', keywords: ['warning', 'caution', 'note'] },
    ],
  },
  {
    name: 'Vibe',
    emojis: [
      { emoji: '✨', label: 'Vibe', keywords: ['special', 'magic', 'highlight'] },
      { emoji: '❤️', label: 'Favourite', keywords: ['love', 'heart', 'must do'] },
      { emoji: '💫', label: 'Highlight', keywords: ['special', 'memorable'] },
      { emoji: '🥳', label: 'Celebration', keywords: ['birthday', 'party', 'anniversary'] },
      { emoji: '💍', label: 'Wedding', keywords: ['engagement', 'ceremony', 'anniversary'] },
      { emoji: '👨‍👩‍👧', label: 'Family time', keywords: ['kids', 'family', 'group'] },
      { emoji: '👯', label: 'Friends', keywords: ['group', 'together', 'crew'] },
      { emoji: '🐣', label: 'Kid friendly', keywords: ['children', 'family', 'kids'] },
      { emoji: '☀️', label: 'Sunny', keywords: ['weather', 'clear', 'hot'] },
      { emoji: '🌦', label: 'Changeable', keywords: ['weather', 'showers'] },
      { emoji: '🌁', label: 'Foggy', keywords: ['mist', 'weather', 'haze'] },
      { emoji: '🦋', label: 'Slow morning', keywords: ['gentle', 'easy', 'relaxed'] },
      { emoji: '🎊', label: 'Festival', keywords: ['event', 'celebration', 'parade'] },
      { emoji: '🏳️‍🌈', label: 'Pride', keywords: ['lgbtq', 'parade', 'festival'] },
    ],
  },
]

/** Flat list — the picker's grid and any consumer that just wants every emoji. */
export const SLOT_EMOJIS: SlotEmoji[] = SLOT_EMOJI_GROUPS.flatMap((g) => g.emojis)

// Default emoji per category when no custom icon is set
export const CATEGORY_ICONS: Record<string, string> = {
  food: '🍽',
  activity: '🎭',
  travel: '✈️',
  accommodation: '🏨',
  vibe: '✨',
}

function matches(entry: SlotEmoji, group: string, q: string): boolean {
  if (entry.label.toLowerCase().includes(q)) return true
  if (group.toLowerCase().includes(q)) return true
  return (entry.keywords ?? []).some((k) => k.includes(q))
}

interface SlotIconPickerProps {
  open: boolean
  current: string
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function SlotIconPicker({ open, current, onSelect, onClose }: SlotIconPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <PickerPanel current={current} onSelect={onSelect} onClose={onClose} />
      )}
    </AnimatePresence>
  )
}

/**
 * Split out so it unmounts with AnimatePresence — the search box then resets
 * itself on every reopen without an effect reaching back into state.
 */
function PickerPanel({
  current,
  onSelect,
  onClose,
}: Omit<SlotIconPickerProps, 'open'>) {
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Escape clears the search first, then closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (query) setQuery('')
      else onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, query])

  // Focus search on pointer devices only — autofocus on touch would throw up
  // the keyboard over the grid
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      searchRef.current?.focus()
    }
  }, [])

  const q = query.trim().toLowerCase()

  const groups = useMemo(() => {
    if (!q) return SLOT_EMOJI_GROUPS
    return SLOT_EMOJI_GROUPS.map((g) => ({
      name: g.name,
      emojis: g.emojis.filter((e) => matches(e, g.name, q)),
    })).filter((g) => g.emojis.length > 0)
  }, [q])

  const resultCount = groups.reduce((n, g) => n + g.emojis.length, 0)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 top-full mt-2 z-10 bg-background border border-border rounded-xl shadow-xl p-3"
    >
      {/* Search */}
      <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-muted/50 border border-border/60 focus-within:border-primary/40 transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="Search icons"
          className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); searchRef.current?.focus() }}
            className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto overflow-x-hidden overscroll-contain">
        {resultCount === 0 ? (
          <p className="text-xs text-muted-foreground/70 text-center py-6">
            No icons match “{query}”
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} className="pb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium px-1 pt-1 pb-1 sticky top-0 bg-background">
                {group.name}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map(({ emoji, label }) => (
                  <button
                    key={`${group.name}-${emoji}`}
                    type="button"
                    title={label}
                    onClick={() => { onSelect(emoji); onClose() }}
                    className={`w-9 h-9 text-xl flex items-center justify-center rounded-lg transition-colors hover:bg-muted ${
                      current === emoji ? 'bg-primary/10 ring-1 ring-primary/40' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
