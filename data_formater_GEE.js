var conus = ee.FeatureCollection("TIGER/2018/States")
var wq = ee.Image("projects/ee-shopvac18/assets/ID_combined_wq"),
var bio = ee.Image("projects/ee-shopvac18/assets/ID_EMF_combined_bio")
var dist = ee.Image("projects/ee-shopvac18/assets/ID_EMF_combined_dist")
var rsd = ee.Image("projects/ee-shopvac18/assets/ID_rsd_2003_2024")
   
	
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
    ['Ca','pH', 'Nitrogen', 'DO', 'Phos']
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

///////////////////////////////////////////////////////////////////////////////////////////////
var training_wq_renamed = renameBands_wq(training_wq)
print(training_wq_renamed)

var training_bio_renamed = renameBands_bio(training_bio)
print(training_bio_renamed)

var training_dist_renamed = renameBands_dist(training_dist)
print(training_dist_renamed)
var training_region = conus.filter(ee.Filter.eq("STUSPS", training_state)).geometry()
var training_predictors = training_wq_renamed.addBands([training_rsd, training_bio_renamed, training_dist_renamed]).clip(training_region)

print(training_predictors)
Map.addLayer(training_predictors)

Export.image.toAsset({
  image: training_predictors,
  description: training_state + '_predictors_' + my_taxa,
  assetId: training_state + '_predictors_' + my_taxa,
  crs: "EPSG:5070",
  region: training_region,
  scale: my_scale
});
// There are too many pixels for export to drive for the entire state. Use the geometry rectangle tool below to create a box around your area of interest
// This will create a geometry variable that we will use as the region for exporting.

Export.image.toDrive({
  image: training_predictors,  // your full predictor stack
  description: 'predictors_' + my_taxa,
  crs: "EPSG:5070",
  scale: my_scale,
  region: training_region
  maxPixels: 1e13
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
