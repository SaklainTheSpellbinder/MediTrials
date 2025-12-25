const { Pool } = require('pg');
const { faker } = require('@faker-js/faker');
// Add this line at the VERY TOP of seed.js
require('dotenv').config(); // Load environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'meditrials',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});
// Stats to match your Dashboard
const TARGET_PATIENTS = 142; 
const TARGET_FAILURES = 12;
const TARGET_ACTIVE = 89;

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting Seed Process...');
    await client.query('BEGIN');

    // ==========================================================
    // MODULE 1: STUDY & PROTOCOL (Get or Create Trial)
    // ==========================================================
    let trialId;
    
    // Check if a trial exists
    const trialCheck = await client.query('SELECT trial_id FROM clinical_trials LIMIT 1');
    
    if (trialCheck.rows.length > 0) {
      trialId = trialCheck.rows[0].trial_id;
      console.log(`✅ Using existing Trial ID: ${trialId}`);
    } else {
      const trialRes = await client.query(`
        INSERT INTO clinical_trials (
          trial_nct_id, trial_title, trial_phase, therapeutic_area, 
          trial_status, start_date, estimated_completion_date, target_enrollment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING trial_id
      `, [
        `NCT${faker.string.numeric(8)}`,
        'MediTrials Phase III Efficacy Study',
        'Phase III',
        'Oncology',
        'Recruiting',
        faker.date.past({ years: 1 }),
        faker.date.future({ years: 2 }),
        200
      ]);
      trialId = trialRes.rows[0].trial_id;
      console.log(`✨ Created new Trial ID: ${trialId}`);
    }

    // --- Treatment Arms (Required for Randomization) ---
    // Check if arms exist, if not create A and B
    const armCheck = await client.query('SELECT arm_id FROM treatment_arms WHERE trial_id = $1', [trialId]);
    let armIds = armCheck.rows.map(r => r.arm_id);
    
    if (armIds.length === 0) {
      const armA = await client.query(`
        INSERT INTO treatment_arms (trial_id, arm_code, arm_description, allocation_ratio, blinding_level)
        VALUES ($1, 'ARM A', 'Experimental Drug 100mg', '1:1', 'Double Blind') RETURNING arm_id
      `, [trialId]);
      
      const armB = await client.query(`
        INSERT INTO treatment_arms (trial_id, arm_code, arm_description, allocation_ratio, blinding_level)
        VALUES ($1, 'ARM B', 'Placebo Control', '1:1', 'Double Blind') RETURNING arm_id
      `, [trialId]);
      armIds = [armA.rows[0].arm_id, armB.rows[0].arm_id];
      console.log('✨ Created Treatment Arms');
    }

    // --- Visit Schedules (Required for Visits) ---
    const visitCheck = await client.query('SELECT visit_id FROM visit_schedules WHERE trial_id = $1', [trialId]);
    let visitIds = visitCheck.rows.map(r => r.visit_id);

    if (visitIds.length === 0) {
        const vNames = ['Screening', 'Baseline', 'Week 4', 'Week 8', 'End of Study'];
        for (let i = 0; i < vNames.length; i++) {
            const res = await client.query(`
                INSERT INTO visit_schedules (trial_id, visit_number, visit_name, visit_window_before_days, visit_window_after_days)
                VALUES ($1, $2, $3, 3, 3) RETURNING visit_id
            `, [trialId, i + 1, vNames[i]]);
            visitIds.push(res.rows[0].visit_id);
        }
        console.log('✨ Created Visit Schedule');
    }

    // ==========================================================
    // MODULE 1.5: SITES & USERS
    // ==========================================================
    let siteIds = [];
    const siteCheck = await client.query('SELECT site_id FROM study_sites WHERE trial_id = $1', [trialId]);
    
    if (siteCheck.rows.length < 3) {
      // Create a few more sites if we don't have enough
      for (let i = 0; i < 3; i++) {
        const siteRes = await client.query(`
          INSERT INTO study_sites (trial_id, institution_name, country, site_status, target_enrollment, site_initiation_date)
          VALUES ($1, $2, $3, 'Active', 50, $4)
          RETURNING site_id
        `, [trialId, faker.company.name() + ' Hospital', faker.location.country(), faker.date.past()]);
        siteIds.push(siteRes.rows[0].site_id);
      }
    } else {
      siteIds = siteCheck.rows.map(s => s.site_id);
    }

    // ==========================================================
    // MODULE 4 SETUP: LAB TESTS (Reference Data)
    // ==========================================================
    // Ensure we have some test definitions
    let testIds = [];
    const labCheck = await client.query('SELECT test_id FROM laboratory_tests');
    if (labCheck.rows.length === 0) {
        const tests = [
            { name: 'Hemoglobin', unit: 'g/dL', low: 13.5, high: 17.5 },
            { name: 'White Blood Cell', unit: 'x10^9/L', low: 4.5, high: 11.0 },
            { name: 'Platelets', unit: 'x10^9/L', low: 150, high: 450 },
            { name: 'Creatinine', unit: 'mg/dL', low: 0.7, high: 1.3 }
        ];
        for (const t of tests) {
            const res = await client.query(`
                INSERT INTO laboratory_tests (test_name, unit_of_measure, reference_ranges)
                VALUES ($1, $2, $3) RETURNING test_id
            `, [t.name, t.unit, JSON.stringify({ male_low: t.low, male_high: t.high })]);
            testIds.push(res.rows[0].test_id);
        }
    } else {
        testIds = labCheck.rows.map(r => r.test_id);
    }

    // ==========================================================
    // MODULE 2: PATIENTS (The Heavy Lifting)
    // ==========================================================
    console.log(`🏥 Generating ${TARGET_PATIENTS} patients...`);

    let failuresCreated = 0;
    let activeCreated = 0;

    for (let i = 0; i < TARGET_PATIENTS; i++) {
      const siteId = faker.helpers.arrayElement(siteIds);
      
      // LOGIC: Force statuses to match your dashboard requirements
      let status;
      let screeningStatus;

      if (failuresCreated < TARGET_FAILURES) {
        status = 'Screened'; // Failed patients don't progress to 'Enrolled'
        screeningStatus = 'Failed';
        failuresCreated++;
      } else if (activeCreated < TARGET_ACTIVE) {
        status = 'Active';
        screeningStatus = 'Passed';
        activeCreated++;
      } else {
        status = faker.helpers.arrayElement(['Completed', 'Withdrawn']);
        screeningStatus = 'Passed';
      }

      // 1. Insert Patient
      const patRes = await client.query(`
        INSERT INTO patients (
          trial_patient_id, site_id, date_of_birth, gender, 
          enrollment_date, patient_status, phi_encrypted_flag
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING patient_id
      `, [
        `PT-${faker.number.int({ min: 10000, max: 99999 })}`,
        siteId,
        faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
        faker.helpers.arrayElement(['Male', 'Female']),
        faker.date.past(),
        status
      ]);
      const patientId = patRes.rows[0].patient_id;

      // 2. Insert Screening
      await client.query(`
        INSERT INTO patient_screening (
          patient_id, screening_date, screening_status, eligibility_score, failed_criteria
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        patientId,
        faker.date.recent({ days: 60 }),
        screeningStatus,
        screeningStatus === 'Passed' ? 10 : 5,
        screeningStatus === 'Failed' ? JSON.stringify(['Criterion 3: BP too high']) : null
      ]);

      // 3. Insert Consent
      await client.query(`
        INSERT INTO informed_consent (
            patient_id, consent_version, consent_date, consent_method, witness_name
        ) VALUES ($1, 'V1.0', $2, 'Electronic', $3)
      `, [patientId, faker.date.past(), faker.person.fullName()]);

      // --- IF PATIENT PASSED SCREENING ---
      if (screeningStatus === 'Passed') {
        
        // 4. Randomization (Assign to Arm A or B)
        const armId = faker.helpers.arrayElement(armIds);
        await client.query(`
            INSERT INTO randomization_assignments (
                patient_id, arm_id, randomization_date, randomization_method
            ) VALUES ($1, $2, $3, 'IWRS')
        `, [patientId, armId, faker.date.recent({ days: 50 })]);

        // 5. Visits & Data Collection
        // Generate a few visits for active/completed patients
        const visitsToGenerate = status === 'Active' ? 2 : 4; 
        
        for (let v = 0; v < visitsToGenerate; v++) {
            if (v >= visitIds.length) break;
            
            // Create Visit Instance
            const visitRes = await client.query(`
                INSERT INTO patient_visits (
                    patient_id, visit_id, scheduled_date, actual_visit_date, visit_status
                ) VALUES ($1, $2, $3, $4, 'Completed')
                RETURNING visit_instance_id
            `, [
                patientId, 
                visitIds[v], 
                faker.date.recent(), 
                faker.date.recent()
            ]);
            
            const visitInstanceId = visitRes.rows[0].visit_instance_id;

            // 6. Lab Results (Module 4)
            for (const testId of testIds) {
                // Generate realistic-ish numbers
                const val = faker.number.float({ min: 10, max: 20, precision: 0.1 }); 
                await client.query(`
                    INSERT INTO lab_results (
                        patient_id, test_id, visit_instance_id, result_value, 
                        result_date, result_status, critical_result_flag
                    ) VALUES ($1, $2, $3, $4, NOW(), 'Completed', false)
                `, [patientId, testId, visitInstanceId, val]);
            }

            // 7. Vital Signs (Module 4)
            await client.query(`
                INSERT INTO vital_signs (
                    patient_id, visit_instance_id, measurement_time, 
                    systolic_bp, diastolic_bp, heart_rate, temperature
                ) VALUES ($1, $2, NOW(), $3, $4, $5, 98.6)
            `, [
                patientId, visitInstanceId, 
                faker.number.int({ min: 110, max: 140 }),
                faker.number.int({ min: 70, max: 90 }),
                faker.number.int({ min: 60, max: 100 })
            ]);
        }
        
        // 8. Adverse Events (Module 5) - 10% chance
        if (faker.number.int({ min: 1, max: 10 }) === 1) {
            await client.query(`
                INSERT INTO adverse_events (
                    patient_id, ae_term, ae_start_date, severity_grade, causality_relationship
                ) VALUES ($1, $2, NOW(), $3, 'Possible')
            `, [
                patientId, 
                faker.helpers.arrayElement(['Headache', 'Nausea', 'Dizziness', 'Mild Rash']),
                faker.number.int({ min: 1, max: 3 })
            ]);
        }
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seed Complete!');
    console.log(`📊 Stats Created:
      - Patients: ${TARGET_PATIENTS}
      - Screen Failures: ${failuresCreated} (Matches UI Failures)
      - Active: ${activeCreated} (Matches UI Active)
      - Sites: ${siteIds.length}
      - Lab Data & Visits generated for enrolled patients.
    `);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error Seeding Database:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();