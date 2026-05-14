"""
Generate Word Document from Comprehensive Analysis Results
"""

import json
import sys
from pathlib import Path
from datetime import datetime

try:
    from python_docx import Document
    from python_docx.shared import Inches, Pt, RGBColor
    from python_docx.enum.text import WD_ALIGN_PARAGRAPH
    from python_docx.oxml.ns import qn
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("Error: python-docx not available. Install with: pip install python-docx")
    sys.exit(1)


def generate_word_report(json_path: str, output_path: str = None):
    """Generate Word document from JSON analysis results"""
    
    # Load JSON results
    with open(json_path, 'r') as f:
        results = json.load(f)
    
    # Create document
    doc = Document()
    
    # Title
    title = doc.add_heading('Comprehensive Sign Language ML Analysis Report', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Add date
    date_paragraph = doc.add_paragraph()
    date_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_run = date_paragraph.add_run(f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}")
    date_run.italic = True
    
    # Executive Summary
    doc.add_heading('Executive Summary', level=1)
    doc.add_paragraph(
        "This report provides a comprehensive analysis of the LexiSight sign language ML system "
        "using 20 different metrics covering MediaPipe stability, dataset quality, model behavior, "
        "temporal analysis, normalization, real-time performance, feature separability, landmark "
        "importance, occlusion, lighting robustness, angle robustness, transition stability, "
        "idle detection, temporal consistency, embedding visualization, data leakage detection, "
        "stress testing, sequence alignment, confidence calibration, and failure categorization."
    )
    
    # Add critical findings summary
    doc.add_heading('Critical Findings Summary', level=2)
    
    critical_findings = []
    
    # Check for critical issues
    if 'dataset_quality' in results:
        dq = results['dataset_quality']
        if dq.get('imbalance_ratio', 0) > 5:
            critical_findings.append(f"• SEVERE dataset imbalance: {dq.get('imbalance_ratio', 0):.1f}x ratio")
        if dq.get('avg_users_per_class', 0) < 2:
            critical_findings.append(f"• CRITICAL: Only {dq.get('avg_users_per_class', 0):.1f} users per class (overfitting risk)")
    
    if 'model_behavior' in results:
        mb = results['model_behavior']
        if mb.get('flicker_rate', 0) > 0.3:
            critical_findings.append(f"• HIGH prediction flicker rate: {mb.get('flicker_rate', 0)*100:.1f}%")
        if mb.get('overall_accuracy', 0) < 0.5:
            critical_findings.append(f"• LOW overall accuracy: {mb.get('overall_accuracy', 0)*100:.1f}%")
    
    if 'mediapipe_stability' in results:
        ms = results['mediapipe_stability']
        if ms.get('avg_jitter', 0) > 0.05:
            critical_findings.append(f"• UNSTABLE landmark tracking: jitter = {ms.get('avg_jitter', 0):.4f}")
    
    if 'occlusion' in results:
        occ = results['occlusion']
        if occ.get('occlusion_rate', 0) > 0.5:
            critical_findings.append(f"• HIGH occlusion rate: {occ.get('occlusion_rate', 0)*100:.1f}%")
    
    if critical_findings:
        for finding in critical_findings:
            p = doc.add_paragraph(finding)
            p.runs[0].font.color = RGBColor(200, 0, 0)
            p.runs[0].font.bold = True
    else:
        doc.add_paragraph("No critical issues detected.")
    
    # Generate each section
    for section_name, section_results in results.items():
        if not section_results or section_results == "N/A":
            continue
            
        # Add section heading
        section_title = section_name.replace('_', ' ').title()
        doc.add_heading(section_title, level=1)
        
        # Add section content
        if isinstance(section_results, dict):
            for key, value in section_results.items():
                if value is None or value == "N/A":
                    continue
                    
                # Format key nicely
                key_formatted = key.replace('_', ' ').title()
                
                if isinstance(value, (int, float)):
                    # Format numbers nicely
                    if isinstance(value, float):
                        if 0 <= value <= 1:
                            formatted_value = f"{value:.2%}"
                        else:
                            formatted_value = f"{value:.4f}"
                    else:
                        formatted_value = str(value)
                    
                    p = doc.add_paragraph()
                    p.add_run(f"{key_formatted}: ").bold = True
                    p.add_run(formatted_value)
                    
                elif isinstance(value, dict):
                    # Nested dictionary
                    p = doc.add_paragraph()
                    p.add_run(f"{key_formatted}:").bold = True
                    
                    for subkey, subvalue in value.items():
                        if subvalue is None or subvalue == "N/A":
                            continue
                            
                        subkey_formatted = subkey.replace('_', ' ').title()
                        
                        if isinstance(subvalue, (int, float)):
                            if isinstance(subvalue, float):
                                if 0 <= subvalue <= 1:
                                    formatted_subvalue = f"{subvalue:.2%}"
                                else:
                                    formatted_subvalue = f"{subvalue:.4f}"
                            else:
                                formatted_subvalue = str(subvalue)
                        else:
                            formatted_subvalue = str(subvalue)
                        
                        doc.add_paragraph(f"  {subkey_formatted}: {formatted_subvalue}", style='List Bullet')
                
                elif isinstance(value, list):
                    # List value
                    p = doc.add_paragraph()
                    p.add_run(f"{key_formatted}: ").bold = True
                    
                    if len(value) > 20:
                        p.add_run(f"{len(value)} items (truncated for brevity)")
                    else:
                        for item in value[:10]:  # Show first 10 items
                            doc.add_paragraph(f"  {item}", style='List Bullet')
                        if len(value) > 10:
                            doc.add_paragraph(f"  ... and {len(value) - 10} more items", style='List Bullet')
                
                else:
                    # String or other
                    p = doc.add_paragraph()
                    p.add_run(f"{key_formatted}: ").bold = True
                    p.add_run(str(value))
    
    # Add recommendations section
    doc.add_heading('Recommendations', level=1)
    
    recommendations = []
    
    # Dataset recommendations
    if 'dataset_quality' in results:
        dq = results['dataset_quality']
        if dq.get('imbalance_ratio', 0) > 3:
            recommendations.append("• Address dataset imbalance through data augmentation or class weighting")
        if dq.get('avg_users_per_class', 0) < 2:
            recommendations.append("• Collect data from more diverse signers to reduce overfitting risk")
    
    # Model recommendations
    if 'model_behavior' in results:
        mb = results['model_behavior']
        if mb.get('flicker_rate', 0) > 0.2:
            recommendations.append("• Implement prediction smoothing or temporal modeling to reduce flicker")
        if mb.get('overall_accuracy', 0) < 0.7:
            recommendations.append("• Improve model architecture or training methodology")
    
    # Stability recommendations
    if 'mediapipe_stability' in results:
        ms = results['mediapipe_stability']
        if ms.get('avg_jitter', 0) > 0.02:
            recommendations.append("• Improve landmark stability through better preprocessing or filtering")
    
    # Occlusion recommendations
    if 'occlusion' in results:
        occ = results['occlusion']
        if occ.get('occlusion_rate', 0) > 0.2:
            recommendations.append("• Address occlusion issues through better recording guidelines or occlusion handling")
    
    # Add recommendations to document
    if recommendations:
        for rec in recommendations:
            doc.add_paragraph(rec, style='List Bullet')
    else:
        doc.add_paragraph("No specific recommendations based on current analysis.")
    
    # Add methodology section
    doc.add_heading('Methodology', level=1)
    doc.add_paragraph(
        "This analysis was performed using a comprehensive evaluation framework that examines "
        "20 different aspects of the sign language ML system. Each metric provides insights into "
        "different dimensions of system performance, from data quality to real-time behavior."
    )
    
    doc.add_paragraph("The analysis includes:", style='List Bullet')
    doc.add_paragraph("MediaPipe stability metrics (detection rate, jitter, switching)", style='List Bullet')
    doc.add_paragraph("Dataset quality metrics (balance, diversity, sequence statistics)", style='List Bullet')
    doc.add_paragraph("Model behavior metrics (confidence, flicker, confusion matrix)", style='List Bullet')
    doc.add_paragraph("Temporal analysis (motion magnitude, gesture detection)", style='List Bullet')
    doc.add_paragraph("Normalization metrics (coordinate ranges, scaling)", style='List Bullet')
    doc.add_paragraph("Real-time performance (FPS, latency)", style='List Bullet')
    doc.add_paragraph("Feature separability (inter-class distance, intra-class variance)", style='List Bullet')
    doc.add_paragraph("Landmark importance analysis", style='List Bullet')
    doc.add_paragraph("Occlusion metrics", style='List Bullet')
    doc.add_paragraph("And 8 more specialized analyses", style='List Bullet')
    
    # Save document
    if output_path is None:
        output_path = str(Path(json_path).parent / "comprehensive_analysis_report.docx")
    
    doc.save(output_path)
    print(f"Word document saved to: {output_path}")
    
    return output_path


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate Word document from analysis results')
    parser.add_argument('--json-path', type=str, required=True,
                        help='Path to JSON analysis results')
    parser.add_argument('--output-path', type=str, default=None,
                        help='Path for output Word document')
    
    args = parser.parse_args()
    
    generate_word_report(args.json_path, args.output_path)


if __name__ == '__main__':
    main()
