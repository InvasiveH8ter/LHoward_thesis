var conus = ee.FeatureCollection("TIGER/2018/States")
var huc8 = ee.FeatureCollection("USGS/WBD/2017/HUC08")
var wq = ee.Image("projects/ee-YourProject/assets/YourStateAbbrev_combined_wq"),
var bio = ee.Image("projects/ee-YourProject/assets/YourStateAbbrev_YourTaxonAbbrev_combined_bio")
var dist = ee.Image("projects/ee-YourProject/assets/YourStateAbbrev_YourTaxonAbbrev_combined_dist")
var rsd = ee.Image("projects/ee-YourProject/assets/YourStateAbbrev_rsd_2003_2024")
var native_sim = ee.Image("projects/ee-YourProject/assets/YourStateAbbrev_hr_similarity")
var mn_predictors = ee.Image("projects/ee-YourProject/assets/mn_predictors_multiband")
	
var my_taxa = 'EMF' //Change to your taxa
var training_state = 'ID' //Change to your state

var training_wq = wq
var training_bio = bio
var training_dist = dist
var training_rsd = rsd

var my_scale = 1000
///////////////////////////////////////////////
var renameBands_wq = function(image) {
  return image.select(
    ['b1', 'b2', 'b3', 'b4', 'b5'],
    ['Ca','pH', 'Nitrogen', 'DO', 'Phos', "Water_Temp", "Salinity"]
  );
};

var renameBands_bio = function(image) {
  return image.select(
    ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
    ['Inv_Algae', 'Inv_Crustaceans', 'Inv_Fish', 'Inv_Mollusks',
    'Inv_Plants', 'Inv_Richness', 'Native_Fish_Richness']
  );
};

var renameBands_dist = function(image) {
  return image.select(
    ['b1', 'b2'],
    ['Distance_Roads', 'Distance_River']
  );
};

var renameBands_mn_bands = function(image) {
  return image.select(
    ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 
	'b8', 'b9', 'b10', 'b11', 'b12', 'b13', 'b14', 
	'b15', 'b16', 'b17'],
    ["Boater_Visitation",
    "Water_connectivity",
    "Tsi",
    "Public_Launches",
    "Water_Alteration",
    "alpha_CAT",
    "alpha_CENT",
    "alpha_DAR",
    "alpha_ESX",
    "alpha_OTM",
    "alpha_PRCH",
    "alpha_SAL_Other",
    "alpha_SCUL",
    "alpha_SUCK",
    "alpha_Native_Fish",
    "Richness_MN_Fish",
    "alpha_gamefish",
    "Richness_gamefish"]
  );
};

///////////////////////////////////////////////////////////////////////////////////////////////
var wq_renamed = renameBands_wq(training_wq)
print(wq_renamed)

var bio_renamed = renameBands_bio(training_bio)
print(bio_renamed)

var dist_renamed = renameBands_dist(training_dist)
print(dist_renamed)

var native_sim_renamed = native_sim.rename("homerange_sim")
print(native_sim_renamed)

var training_region = conus.filter(ee.Filter.eq("STUSPS", training_state)).geometry()
var training_predictors = training_wq_renamed.addBands([training_rsd, training_bio_renamed, training_dist_renamed, native_sim_renamed, renameBands_mn_bands]).clip(training_region)

print(training_predictors)
Map.addLayer(training_predictors)

Export.image.toAsset({
  image: training_predictors.toFloat(),
  description: training_state + '_predictors_' + my_taxa,
  assetId: training_state + '_predictors_' + my_taxa,
  crs: "EPSG:5070",
  region: training_region,
  scale: my_scale
});
// There are too many pixels for export to drive for the entire state. Use the geometry rectangle tool below to create a box around your area of interest
// This will create a geometry variable that we will use as the region for exporting.

Export.image.toDrive({
  image: training_predictors.toFloat(),  // your full predictor stack
  description: 'predictors_' + my_taxa,
  crs: "EPSG:5070",
  scale: my_scale,
  region: training_region
  maxPixels: 1e13
});

var huc8_clipped = huc8.filterBounds(training_region)

Export.table.toDrive({
  collection: huc8_clipped,
  description: 'huc_8',
  fileFormat: 'SHP'
});


/////////////////////////////////////////////////////
// If predicting to another state comment out the drive export above
// and uncomment the script below and run instead.
// var predict_state = 'ID'
// var predict_region = conus.filter(ee.Filter.eq("STUSPS", predict_state)).geometry()
// var predict_wq_renamed = renameBands_wq(predict_wq).clip(predict_region)
// print(predict_wq_renamed)

// var predict_bio_renamed = renameBands_bio(predict_bio).clip(predict_region)
// print(predict_bio_renamed)

// var predict_dist_renamed = renameBands_dist(predict_dist).clip(predict_region)
// print(predict_dist_renamed)

// var predict_predictors = predict_wq_renamed.addBands([predict_bio_renamed, predict_rsd, predict_dist_renamed]).clip(predict_region)
// print(predict_predictors)
// Map.addLayer(predict_predictors)


// Export.image.toDrive({
//   image: predict_predictors,  // your full predictor stack
//   description: predict_state + '_' + my_taxa + '_predict_to_raster',
//   crs: "EPSG:5070",
//   scale: 100,
//   region: predict_region,
// });
