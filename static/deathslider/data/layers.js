var layers = [
 {
  name: "Decades",
  column: 1,
  category: 1,
  show: true
 },
 {
  name: "Wars",
  column: 1,
  category: 1,
  show: true
 },
 {
  name: "Countercultures",
  column: 1,
  category: 1,
  show: true
 },
 {
  name: "Deaths",
  column: 0,
  category: 0,
  show: true
 },
 {
  name: "Technological milestones",
  column: 0,
  category: 0,
  show: true
 },
]

var periodlist = [
 {
  start: 1850,
  end: 1860,
  text: "1850s",
  mouseover: "1850s",
  layer: 0
 },
 {
  start: 1860,
  end: 1870,
  text: "1860s",
  mouseover: "1860s",
  layer: 0
 },
 {
  start: 1870,
  end: 1880,
  text: "1870s",
  mouseover: "1870s",
  layer: 0
 },
 {
  start: 1880,
  end: 1890,
  text: "1880s",
  mouseover: "1880s",
  layer: 0
 },
 {
  start: 1890,
  end: 1900,
  text: "1890s",
  mouseover: "1890s",
  layer: 0
 },
 {
  start: 1900,
  end: 1910,
  text: "1900s",
  mouseover: "1900s",
  layer: 0
 },
 {
  start: 1910,
  end: 1920,
  text: "1910s",
  mouseover: "1910s",
  layer: 0
 },
 {
  start: 1920,
  end: 1930,
  text: "1920s",
  mouseover: "Roaring 20s",
  layer: 0
 },
 {
  start: 1930,
  end: 1940,
  text: "1930s",
  mouseover: "Great depression",
  layer: 0
 },
 {
  start: 1940,
  end: 1950,
  text: "1940s",
  mouseover: "Forties",
  layer: 0
 },
 {
  start: 1950,
  end: 1960,
  text: "1950s",
  mouseover: "Fifties",
  layer: 0
 },
 {
  start: 1960,
  end: 1970,
  text: "1960s",
  mouseover: "Sixties",
  layer: 0
 },
 {
  start: 1970,
  end: 1980,
  text: "1970s",
  mouseover: "Seventies",
  layer: 0
 },
 {
  start: 1980,
  end: 1990,
  text: "1980s",
  mouseover: "Eighties",
  layer: 0
 },
 {
  start: 1990,
  end: 2000,
  text: "1990s",
  mouseover: "Nineties",
  layer: 0
 },
 {
  start: 2000,
  end: 2010,
  text: "2000s",
  mouseover: "Zeroes",
  layer: 0
 },
 {
  start: 2010,
  end: 2019,
  text: "2010s",
  mouseover: "2010s",
  layer: 0
 },
 
 {
  start: 1861,
  end: 1865,
  bgcolour: "#000000",
  fgcolour: "#FFFFFF",
  text: "ACW",
  mouseover: "American Civil War",
  layer: 1
 },
 {
  start: 1914,
  end: 1918,
  bgcolour: "#000000",
  fgcolour: "#FFFFFF",
  text: "WW1",
  mouseover: "World war 1",
  layer: 1
 },
 {
  start: 1936,
  end: 1939,
  bgcolour: "#000000",
  fgcolour: "#FFFFFF",
  text: "SCW",
  mouseover: "Spanish civil war",
  layer: 1
 },
 {
  start: 1940,
  end: 1945,
  bgcolour: "#000000",
  fgcolour: "#FFFFFF",
  text: "WW2",
  mouseover: "World war 2",
  layer: 1
 },
 {
  start: 1955,
  end: 1975,
  bgcolour: "#000000",
  fgcolour: "#FFFFFF",
  text: "Vietnam war",
  mouseover: "Vietnam war",
  layer: 1
 },
 {
  start: 1979,
  end: 1989,
  bgcolour: "#000000",
  fgcolour: "#FFFFFF",
  text: "SAW",
  mouseover: "Soviet-Afghan war",
  layer: 1
 },
 
 {
  start: 1920,
  end: 1930,
  bgcolour: "#F7C767",
  text: "Jazz",
  mouseover: "If you have to ask what jazz is, you'll never know.",
  layer: 2
 },
 {
  start: 1933,
  end: 1947,
  bgcolour: "#C10909",
  text: "Swing",
  mouseover: "Hi-dee hi-dee hi-dee hi",
  layer: 2
 },
 {
  start: 1950,
  end: 1964,
  bgcolour: "#679EF7",
  text: "Beatnik",
  mouseover: "Sal, we gotta go and never stop going 'till we get there.'",
  layer: 2
 },
 {
  start: 1965,
  end: 1975,
  bgcolour: "#FF1493",
  text: "Free love",
  mouseover: "Be sure to wear some flowers in your hair",
  layer: 2
 },

];

var eventlist = [
 {
  year: 1854,
  text: "Charge of the Light Brigade",
  mouseover: "Charge of the Light Brigade",
  layer: 2
 },
 {
  year: 1865,
  text: "Abraham Lincoln",
  mouseover: "Death of Abraham Lincoln",
  layer: 0
 },
 {
  year: 1937,
  text: "Amelia Earhart",
  mouseover: "Death of aviation pioneer Amelia Earhart",
  layer: 0
 },
 {
  year: 1955,
  text: "Einstein",
  mouseover: "Death of Albert Einstein",
  layer: 0
 },
 {
  year: 1963,
  text: "JFK",
  mouseover: "Death of JFK",
  layer: 0
 },
 {
  year: 1981,
  text: "Bob Marley",
  mouseover: "Death of Bob Marley",
  layer: 0
 },
 {
  year: 1990,
  text: "Jim Henson",
  mouseover: "Death of Jim Henson",
  layer: 0
 },
 {
  year: 2001,
  text: "9/11",
  mouseover: "Attack on the World Trade Center and the Pentagon",
  layer: 0
 },
 {
  year: 1949,
  text: "ENIAC",
  mouseover: "First general purpose computer",
  layer: 1
 },
 {
  year: 1961,
  text: "Gagarin",
  mouseover: "Yuri Gagarin is first man to orbit the earth",
  layer: 1
 },
 {
  year: 1969,
  text: "Moonlanding",
  mouseover: "Apollo 11 lands on the moon",
  layer: 1
 },
 {
  year: 2005,
  text: "YouTube",
  mouseover: "YouTube founded",
  layer: 1
 }
 
];
