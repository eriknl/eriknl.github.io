---
layout: post
title:  "Introducing the 'Deathslider'"
date:   2019-03-16 21:30:00 +0200
category: statistics
tags: [software, web, statistics]
---
This is a short introduction to a statistics experiment dubbed the ['Deathslider'](/static/deathslider/index.html).

The Deathslider
------------

When reading the news or browsing sites like Wikipedia I often found myself wondering about how the time since events has influenced general sentiment. For instance when reading about the renewed interest in fascism in Italy and Spain I realised it has already been neary 75 years since the end of the second world war. This made me wonder how many people are actually still alive that lived through Mussolini's days.
To get some insights I looked up statistics about the world population and it occured to me that it's a pretty easy calculation to make for any year. So the seed for what is now called the Deathslider was planted. After a couple of months I thought about it again and found a website with an excellent API that gives free access to population data from 1950 to the present: [Population.io](http://api.population.io/)
Because there is data from 1950 and the maximum age specified in each year is 100 we can go back all the way to 1850 as the starting year for the calculations. From this amazing data we can conclude there were 40330 people who lived through both Gagarin orbiting the earth and the assasination of Abraham Lincoln!

Once the data was available it was mostly a matter of slapping together a site. Because I think my interests in the matter are partly fuelled by years of [XKCD](https://xkcd.com) I went for an XKCD theme with hand drawn elements.
