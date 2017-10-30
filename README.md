Github Commit Summary

we are working with Github commit histories of open source projects. The task in our project is to summarize the number (and possibly size) of commits for code contributors over time.

An average open source project on Github contains between 10-50 contributors.

We propose to use a modified version of CirceView as proposed in https://bib.dbvis.de/uploadedFiles/118.pdf

We propose the following modifications.
Each segment will represent a contributor and there will be upto 52 concentric tracks to represent one entire year in weeks
Time flows in the opposite direction as more recent commit histories are more relevant and should be given more real estate.
We will use a monochromatic palette (Black & White) to better show project contributions with contrast. The darkness of a cell represents the number of commits in that week by that contributor. This technique will be used along with bending sticks to provide better comparison on quantities.

Tasks to be addressed:

1) Compare: The patterns in the concentric rings placed adjacent for different collaborators will be used to compare the commits performed by them over a period of time.

2) Identify: Changes in commit pattern can be identified for each collaborator. The monochromatic palette will help to identify which weeks were the one where maximum commits were performed to the repository and vice versa.

3) Summarise: The circle view will help to summarise the data of an entire year into weeks represented by each ring in the visualisation.

4) Consume: The circle view visualisation will consume data it receives and the changes will be updated accordingly. For example: If a new collaborator is added to the repository then the circle will be split to make space for one more attribute.

5) Search: Drill down operations can be performed by a user if the user wants to search for a particular week. It can then be split into days of a week to search for any particular commit for a single day.

6) Produce: If we hover over a particular segment of the ring, then it will produce the details for that week to the user. The details may include data like the name of the collaborator, file name on which commit was performed, time of the commit etc.