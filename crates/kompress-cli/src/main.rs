use anyhow::Result;
use clap::{Parser, Subcommand};
use kompress_brain::graph::BrainGraph;
use kompress_core::pipeline::Pipeline;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "kompress")]
#[command(about = "Kompress CLI - text compression and brain graph analysis", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Compress text and show compression ratio
    Compress {
        /// Text to compress
        text: String,
    },
    /// Analyze brain graph
    Brain,
    /// List key entities and their roles
    Persons,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Compress { text } => compress_command(&text)?,
        Commands::Brain => brain_command()?,
        Commands::Persons => persons_command()?,
    }

    Ok(())
}

fn compress_command(text: &str) -> Result<()> {
    let pipeline = Pipeline::new();
    let result = pipeline.run(vec![text.to_string()])?;

    let input_size = text.len();
    let output_size = result.iter().map(|s| s.len()).sum::<usize>();
    let ratio = if input_size > 0 {
        ((input_size - output_size) as f64 / input_size as f64 * 100.0) as i32
    } else {
        0
    };

    println!("Compression ratio: {}%", ratio);
    for (i, unit) in result.iter().enumerate() {
        println!("Unit {}: {}", i + 1, unit);
    }

    Ok(())
}

fn brain_command() -> Result<()> {
    let brain_path = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?
        .join(".brain/graph.json");

    if !brain_path.exists() {
        return Err(anyhow::anyhow!(
            "Brain graph not found at {}",
            brain_path.display()
        ));
    }

    let graph = BrainGraph::load(&brain_path)?;

    let node_count = graph.nodes().len();
    let edge_count = graph.edges().len();
    let imaginary_count = graph
        .nodes()
        .iter()
        .filter(|node| node.is_imaginary())
        .count();

    println!("Node count: {}", node_count);
    println!("Edge count: {}", edge_count);
    println!("Imaginary node count: {}", imaginary_count);

    Ok(())
}

fn persons_command() -> Result<()> {
    let persons = vec![
        ("RALPH", "The visionary architect"),
        ("LODRI", "The knowledge keeper"),
        ("KRENGEL", "The bridge builder"),
        ("PETER", "The action taker"),
        ("COSMOS", "The universal connector"),
    ];

    for (name, role) in persons {
        println!("{}: {}", name, role);
    }

    Ok(())
}
