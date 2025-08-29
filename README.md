Step 1) Download GitHub Repository and Unzip
	
	Remember where you put this because you need the folder path later!!!

Step 2) Create a Google Earth Engine (GEE) account w/ noncommercial cloud project: 	https://code.earthengine.google.com/register
	
	Once you get this finished, you can access the GEE code editor at https://code.earthengine.google.com
	Note: You can have multiple GEE code editor windows open at the same time
	
	Now, open the two .js files you downloaded from the repository and paste each into a seperate gee script and save
	
	The RSD predictors take a while to complete so get this started using the make_rsd_predictors_GEE script you just saved.  
	
	You can create these predictors for any state by changing the state abbreviation in this line:
	
	var my_state = 'WI' // Change to your state
	   

Step 3) Download and install the latest version of Conda: https://www.anaconda.com/products/distribution

Open the Conda Powershell using your start menu. In the conda powershell, navigate to the directory where you stored the downloaded scripts
	
 	
	cd C:/Users/your_folderpath
	
	
 Run setup script.  
	
 	
	python nasdm_setup.py
	
	
 Activate your environment
	
 	
	conda activate nasdm
	
 
Open the Jupyter notebook using Conda by runnning:
	
 	
	python -m notebook
	
 
This will open a tab named Home in your browser which functions just like your Windows file folders.

Step 4) Create Water Chemistry, Biological and Distance predictors
	
	Once you have the Jupyter Notebook tab open in a browser, navigate to where you unziped the repository files (you are probably already there if you changed to your file directory in Conda)

	Open the make_predictors_github.ipynb notebook

	Use the run button in the header to run blocks of code in Juptyer Notebook

	You will need to define these values
	```
	training_state_abbr = 'MN' (2-digit postal abbreviation)
	training_state_name = 'Minnesota' (State name spelled out)
	nas_id = 5 (NAS species id from USGS NAS database)
	nas_name = 'zm' (whatever you want to use as an abbreviation for your model taxa)
	training_fip = '27' (State FIP identification number; Google it)
	```
	
	

Step 5) Upload locally created predictor rasters, background and positive training data to GEE
	
	Go back to your GEE code editor and click on the Assets tab. Now click on the red NEW drop downdown menu.
	First upload the .tif files.  You should have 3 to upload (Chemistry, Biological and Distance tifs)
		
	Now, upload your background and positive training data shapefiles. You need to upload all files associated withe 	your shapefile. So highlight the .cpg, .dbf, .prj, .shp, and .shx otherwise GEE will give you a prompt about what 	you are missing.
	


Step 6) Combine your predictors into a single GEE image.
	
	Open the data_formater_GEE script you created
	Import the images you just uploaded into the script by clicking on them in your asset list and using the import button from the window that opens.
	Rename to wq, bio, dist and rsd
	Change state abbreviation and taxa abbreviation variables to match your data.

	You will also need to create a geometry manually for your area of interest for creating your final heatmap.  This is done using the rectangle drawing tool
	on the map below the coding window. 
	
Step 7) Run the model

	Now that you have all you predictors, open the model script notebook, replace the user defined variables with your information and run the rest of the cells to start modelling. 

