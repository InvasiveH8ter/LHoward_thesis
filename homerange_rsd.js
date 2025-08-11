// Add instructions to make homerange
// Create a geometry for the region of origin for your taxa.
// Delete the homerange polygon asset above.
// Use box map tool below to create a geometry and name it homerange.

var my_state = 'WI'
var invaded_geo = conus.filter(ee.Filter.eq("STUSPS", my_state)).geometry()

// User Defined Variables
var start_year = 2003
var end_year = 2022
var years = ee.List.sequence(start_year, end_year);

var my_scale = 1000
//////////////////////////////////////////////////////////////////////
var fill_func = function(img_to_fill){
  var inverse = img_to_fill.unmask().not().gt(0).selfMask()
  var connected = inverse.connectedComponents({
  connectedness: ee.Kernel.plus(1),
  maxSize: 100
})
var connected_size = connected.select([connected.bandNames().get(0)])
  .connectedPixelCount({
    maxSize: 100, 
    eightConnected: false 
})
var connected_area = ee.Image.pixelArea()
                              .addBands(connected_size)
                              .lte(150000)
                              .gt(0)
                              .selfMask()
                              .select('labels')
  
var fill = img_to_fill.focalMax(1,'square','pixels',10)
                            .updateMask(connected_area)
                            .selfMask()

return img_to_fill.addBands(fill)
  .reduce(ee.Reducer.max()).regexpRename('max','filled')
}
/////////////////////////////////////////////////////////////////////
var NLDAS_precip = NLDAS.select("total_precipitation");
var sw_occurrence = pekel_static_water.select('monthly_recurrence').mean()
                      .rename(['SurfaceWaterOccurrence'])
                      .unmask()

var srtmChili = CHILI.select("constant").rename('Heat_Insolation');
var topoDiv = topoDiversity.select("constant").rename("Topo_Diversity")

//var elevation = DEM.select('elevation')
var footprint = gHM.select("gHM");
var my_gHM = (footprint.map(fill_func).max()).rename('gHM')

//QC filters
var cloudMask_GPP = function(img){
  var quality_GPP = img.select("Psn_QC")
  var mask_GPP = quality_GPP.neq(1)
  return img.updateMask(mask_GPP)
};              
var GPP_QC = GPP.map(cloudMask_GPP).select("Gpp")
//print(GPP_QC)
//Map.addLayer(GPP_QC)



var cloudMask_LST = function(img){
  var quality_LST = img.select(['QC_Day']);
  var clear_LST = quality_LST.bitwiseAnd(3).eq(0) 
                .and(quality_LST.bitwiseAnd(12).eq(0))
    return img.mask(clear_LST)
};   
var LST_QC = modusGlobal.map(cloudMask_LST).select("LST_Day_1km")

//print(LST_QC)

var cloudMask_VCF = function(img){
  var quality_VCF = img.select("Quality")
  var mask_VCF = quality_VCF.bitwiseAnd(2).eq(0) 
                    .and(quality_VCF.bitwiseAnd(4).eq(0))
                    .and(quality_VCF.bitwiseAnd(8).eq(0)) 
                    .and(quality_VCF.bitwiseAnd(16).eq(0)) 
                    .and(quality_VCF.bitwiseAnd(32).eq(0))
    return img.mask(mask_VCF)
}

var cloudMask_veg = function(img){
  var quality_veg = img.select("SummaryQA")
  var mask_veg = quality_veg.eq(0)
    return img.updateMask(mask_veg)
  
}
var modusVeg_QC = modusVeg.map(cloudMask_veg)
// var EVI = modusVeg_QC.select("EVI")
// var NDVI = modusVeg_QC.select("NDVI")

//print(modusVeg_QC)

var my_precip = global_precip.select('precipitation')

//////////////////////////////////////////////////////////////////
// Precip
var total_precip_spring = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return my_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(60,151))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Spring');
    })
  ).median();
//print(total_precip_spring)
var total_precip_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return my_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Summer');
    })
  ).median();

var total_precip_fall = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return my_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(244,334))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Fall');
    })
  ).median();

var total_precip_winter = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return my_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(244,59))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Winter');
    })
  ).median();
  
var precip_bands = total_precip_winter
                        .addBands(total_precip_spring)
                        .addBands(total_precip_summer)
                        .addBands(total_precip_fall)



// Greeness
// Tree cover
// var VCF_QC = VCF.map(cloudMask_VCF)
// var Tree_Cover = ee.ImageCollection.fromImages(
//     years.map(function(y) {
//       return VCF_QC.select("Percent_Tree_Cover")
//         .filter(ee.Filter.calendarRange(y, y, 'year'))
//         .filter(ee.Filter.dayOfYear(152,243))
//         .reduce(ee.Reducer.max())
//         .set('year', y);
//     })
//   )
  
// var Tree_Cover_summer = (Tree_Cover.map(fill_func).median()).rename('Tree_Cover')

// NDVI
var NDVI_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return modusVeg_QC.select("NDVI")
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.max())
        .set('year', y);
    })
  )
  
var ndvi_summer_max = (NDVI_summer.map(fill_func).median()).rename('NDVI')


var EVI_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return modusVeg_QC.select("EVI")
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
  
var evi_summer_med = (EVI_summer.map(fill_func).median()).rename('EVI')

//////////////////////////////////////////////////////////
var GPP_median = GPP_QC
        .filter(ee.Filter.calendarRange(start_year, end_year, 'year'))
// //Map.addLayer(GPP_median)

var GPP_annual_median = (GPP_median.map(fill_func).median()).rename('GPP_Annual')
print(GPP_annual_median)
// Map.addLayer(GPP_annual_median)
var GPP_summer = GPP_QC
        .filter(ee.Filter.calendarRange(start_year, end_year, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        
        
var GPP_summer_max = (GPP_summer.map(fill_func).median()).rename('GPP_Summer')
print(GPP_summer_max)

var greeness_bands = ndvi_summer_max.addBands([GPP_annual_median, GPP_summer_max])
////////////////////////////////////////////////////////////////
// LST
var LST_annual = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_annual_median = (LST_annual.map(fill_func).median()).rename('LST_Annual')  
//Map.addLayer(LST_annual_median)

var LST_spring = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,273))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_spring_median = (LST_spring.map(fill_func).median()).rename('LST_Spring')  
//Map.addLayer(LST_spring_median)


var LST_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.max())
        .set('year', y);
    })
  )
var LST_summer_max = (LST_summer.map(fill_func).median()).rename('LST_Summer')  
//Map.addLayer(LST_summer_max)

var LST_fall = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(244,334))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_fall_median = (LST_fall.map(fill_func).median()).rename('LST_Fall')  


var LST_winter = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(335,60))
        .reduce(ee.Reducer.min())
        .set('year', y);
    })
  )
var LST_winter_min = (LST_winter.map(fill_func).median()).rename('LST_Winter')  
//Map.addLayer(LST_annual_mean)

var LST_bands = LST_annual_median.addBands(LST_summer_max)
        .addBands(LST_winter_min)
        .addBands(LST_spring_median)
        .addBands(LST_fall_median)

/////////////////////////////////////////////////////
// Flashiness etc.
var Flash_yearly_stDev = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return pekel_monthly_water
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .reduce(ee.Reducer.sampleStdDev())
        .set('year', y)
        .rename('Flashiness');
    })
  ).median();
//print(Flash_yearly_stDev)

var runoff = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return pekel_monthly_water
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(91,181))
        .reduce(ee.Reducer.max())
        .set('year', y)
        .rename('Runoff');
    })
  ).median();
//print(runoff)
var drawdown = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return pekel_monthly_water
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(182,243))
        .reduce(ee.Reducer.min())
        .set('year', y)
        .rename('Drawdown');
    })
  ).median();

var water_bands = Flash_yearly_stDev
          .addBands(runoff)
          .addBands(drawdown)
          
var static_input_bands = srtmChili.addBands(topoDiv).addBands(my_gHM) 
//Map.addLayer(static_input_bands)
////////////////////////////////////////////////////////////////////

var NDSI_byYear = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return ndsi.select('NDSI_Snow_Cover')
        .filter(ee.Filter.calendarRange(1, 3, 'month'))
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .reduce(ee.Reducer.max())
        .set('year', y);
    })
  )
var ndsi_filled = (NDSI_byYear.map(fill_func).median()).rename('NDSI')


var env_raster = greeness_bands.addBands([precip_bands, static_input_bands, ndsi_filled, water_bands, LST_bands])

//Map.addLayer(env_raster)
///////////////////////////////////////////////////////////////////////////////////////

var cloudMask = function(image){
  var quality =image.select(['QA_PIXEL']);
  // clear = no clouds, coud shadow, or snow
  var clear = quality.bitwiseAnd(1 << 3).eq(0) // cloud shadow
                .and(quality.bitwiseAnd(1 << 5).eq(0)) // cloud
                .and(quality.bitwiseAnd(1 << 4).eq(0)); // snow
  image = image.mask(clear);
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2)
  
  return image.addBands(opticalBands, null, true);
};   


var ndtiCalc = function(image) {
  var ndti = image.normalizedDifference(['SR_B3', 'SR_B2']);
  ndti = ndti.select([0], ['NDTI']);
  return ndti;
};

var ndbiCalc = function(image) {
  var ndbi = image.normalizedDifference(['SR_B5', 'SR_B4']);
  ndbi = ndbi.select([0], ['NDBI']);
  return ndbi;
};

var ndciCalc = function(image) {
  var ndci = image.normalizedDifference(['SR_B4', 'SR_B3']);
  ndci = ndci.select([0], ['NDCI']);
  return ndci;
};

var bandRenamel8 = function(image){
  var rename = image.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
  ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']); 
  return rename; 
};

var periodl7 = lsat_7
    //.filterBounds(multiPoly) 
    .filter((ee.Filter.date('2000-01-01', '2012-12-31')))
    .map(cloudMask);
print(periodl7.limit(10), 'periodl7');

var periodl8 = lsat_8
    //.filterBounds(multiPoly)
    .filter((ee.Filter.date('2013-01-01', '2022-12-31')))
    .map(cloudMask)
    .map(bandRenamel8);
print(periodl8.limit(10), 'periodl8');


var period = ee.ImageCollection(periodl8); 
print (period.limit(10), 'period');


var periodFilter = ee.ImageCollection(period)
  //.filterBounds(multiPoly) //filter bounds to project area
  .filter((ee.Filter.date('2003-01-01', '2022-12-31')))//change range of years here
  .filter(ee.Filter.dayOfYear(152,243))//change range of days here
  
// convert imageCollection to mean image and slect bands 
var periodMedian = periodFilter.select('SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7').median();

var imgNDCI = ndciCalc(periodMedian) //{return img.addBands(ndtiCalc(img)).clip(region)})
var ndci_filled = fill_func(imgNDCI)//.rename('NDCI')
print(ndci_filled)
var imgNDBI = ndbiCalc(periodMedian) //{return img.addBands(ndtiCalc(img)).clip(region)})
var ndbi_filled = fill_func(imgNDBI)//.rename('NDBI')
print(ndbi_filled)
var imgNDTI = ndtiCalc(periodMedian) //{return img.addBands(ndtiCalc(img)).clip(region)})
var ndti_filled = fill_func(imgNDTI)//.rename('NDTI')
print(ndti_filled)


var nd = imgNDTI.addBands([imgNDBI, imgNDCI])

var mess_rsd = nd.addBands(env_raster).toFloat()
Map.addLayer(mess_rsd)


Export.image.toDrive({
  image: mess_rsd,
  description: 'homerange_' + my_state + '_'+ start_year + "_" + end_year,
  region: homerange,
  scale: my_scale
});

Export.image.toDrive({
  image: mess_rsd,
  description: 'inv_rsd_' + my_state + '_' + start_year + "_" + end_year,
  region: invaded_geo,
  scale: my_scale
});





