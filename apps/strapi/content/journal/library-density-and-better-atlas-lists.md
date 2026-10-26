# A clearer map of library density

Atlas has a new library density layer and a more useful list view. You can follow the distribution of recorded libraries from a continental overview down to a neighbourhood, inspect the numbers behind a cell, and open a library record without losing your place in the results.

## A count with an area

The previous density view followed the clusters used to draw library pins. Those clusters help keep the map readable, but their position and size change as points are grouped on screen.

The new default is a density grid. Each cell counts recorded library locations and divides that count by its geographic area. The shading shows **libraries per 100 km²**, with the map key using the same colours and scale as the layer.

That area is measured on the earth, rather than in screen pixels. It includes water within the cell. A darker cell means more recorded libraries per unit of area; it does not say how many people use them or whether everyone nearby can reach them.

Select a cell to see its recorded count, area and density. You can then zoom to that cell and explore the individual locations.

## Choose the view that fits the question

The analysis drawer lets you switch between the grid and a smooth concentration view. The grid keeps the cell boundaries visible. Smoothing spreads concentration into neighbouring cells to make broader patterns easier to follow. Its colours are relative, while the selected-cell figures still describe the original grid.

Automatic detail follows the map as you zoom. You can also choose continental, regional, local or neighbourhood detail. A cell is an average over an area, so the detail setting affects which patterns stand out. Use the same setting when comparing places.

The fixed comparison scale gives a colour the same density meaning across maps. Local contrast stretches the colours to the highest cell value in the current view, which can help reveal variation in a sparse area. The drawer explains which scale is active. Opacity and smoothing controls let you adjust the presentation, and library locations can appear over the density layer.

Library, service, opening-hours and accessibility filters apply to the density calculation. We also prepare density tiles separately from the pin clusters; when a prepared snapshot cannot represent the current selection, Atlas calculates the matching distribution from the index.

## From a pattern to an individual record

The list now opens in name order. You can reverse that order, sort by place, or put the most or least complete records first. Records without a completeness score are labelled “Not scored” and appear after scored records in either direction.

Name, place and completeness ordering let you browse every matching record. Nearest-centre ordering keeps its 1,000-result limit, with that limit explained in the footer. Exports follow the selected order.

Select a library row to open its Inspect drawer. On desktop, the results stay beside it; on mobile, “Back to results” returns you to the list. Opening and closing the drawer keeps your selected sort, results page and position, and returns keyboard focus to the row.

Two actions stay visible below the details. **View library** opens the full library page. **Improve this record** opens that library in the Index editor, with its existing information filled in. You can check the record before deciding what needs correcting.

## A map of the records we have

Density describes the recorded index. A pale or empty cell is not proof that no library exists there. Missing coordinates, incomplete source directories and libraries still waiting to be added all affect the picture.

Library density, population and Reach answer different questions. Density shows the concentration of recorded locations. Population layers describe residents in sourced geographic areas. Reach estimates walking or cycling access where the required analytical data is available. None of those measures establishes a library's opening hours, visitor eligibility or service quality.

If you know a place well, try [sorting its library records by least complete first](/map?layers=density&list=1&listSort=record). A current official branch page can help verify an address, opening timetable or accessibility detail. Change only what you can source; the editor explains how your contribution is reviewed. You can also [add a missing library](/contribute/index/new).

[Explore library density in Atlas](/map?layers=density).
